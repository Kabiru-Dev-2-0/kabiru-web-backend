import { Injectable } from '@nestjs/common';
import { ExpSource, MasteryLevel, Prisma, ProgressStatus } from '.prisma/progress-client';
import type { GameSubmissionResultDto } from '@kabiru/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeToUtcDate } from '../common/date.util';
import { createRpcError } from '../common/rpc-exception.util';

export interface CreateGameSubmissionInput {
  userId: string;
  testId: string;
  maxScore?: number;
  score?: number;
  rawScore?: number;
  rawMax?: number;
  unit?: string;
  hintsUsed?: number;
  durationSeconds?: number;
  answers?: Record<string, unknown>;
}

export function resolveMasteryFromNormalizedScore(score100: number): MasteryLevel {
  if (score100 >= 95) return MasteryLevel.EXPERT;
  if (score100 >= 85) return MasteryLevel.COMPETENT;
  if (score100 >= 75) return MasteryLevel.ADVANCE;
  if (score100 >= 60) return MasteryLevel.ADVANCE_BEGINNER;
  if (score100 >= 40) return MasteryLevel.BEGINNER;
  return MasteryLevel.NOVICE;
}

@Injectable()
export class SubmissionService {
  constructor(private readonly prisma: PrismaService) {}

  async submitGameTest(dto: CreateGameSubmissionInput): Promise<GameSubmissionResultDto> {
    if (!dto.userId || !dto.testId) {
      throw createRpcError({
        code: 'VALIDATION_ERROR',
        httpStatus: 400,
        message: 'userId dan testId wajib diisi',
      });
    }

    const maxScore = dto.maxScore && dto.maxScore > 0 ? dto.maxScore : 100;
    const rawMax = dto.rawMax !== undefined ? dto.rawMax : maxScore;

    if (!Number.isFinite(rawMax) || rawMax <= 0) {
      throw createRpcError({
        code: 'VALIDATION_ERROR',
        httpStatus: 400,
        message: 'rawMax harus bernilai positif (> 0)',
      });
    }

    const rawCandidate = dto.rawScore !== undefined ? dto.rawScore : dto.score;
    if (rawCandidate === undefined || !Number.isFinite(rawCandidate) || rawCandidate < 0) {
      throw createRpcError({
        code: 'VALIDATION_ERROR',
        httpStatus: 400,
        message: 'Skor permainan tidak valid',
      });
    }

    // Clamping rawScore ke [0, rawMax] & normalisasi ke skala maxScore dan skala 0..100 (FR-35)
    const clampedRaw = Math.min(Math.max(0, rawCandidate), rawMax);
    const finalScore = Number(((clampedRaw / rawMax) * maxScore).toFixed(2));
    const normalized100 = Number(((clampedRaw / rawMax) * 100).toFixed(2));
    const passed = normalized100 >= 70;
    const mastery = resolveMasteryFromNormalizedScore(normalized100);

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 1. Simpan Submission & Score ternormalisasi
      const submission = await tx.submission.create({
        data: {
          userId: dto.userId,
          testId: dto.testId,
          isCorrect: passed,
          hintsUsed: dto.hintsUsed ?? 0,
          mastery,
          durationSeconds: dto.durationSeconds ?? 0,
          answer: {
            ...(dto.answers ?? {}),
            rawScore: clampedRaw,
            rawMax,
            unit: dto.unit ?? null,
          } as Prisma.InputJsonValue,
          score: {
            create: {
              finalScore: new Prisma.Decimal(finalScore),
            },
          },
        },
      });

      const prevProgress = await tx.progressTest.findUnique({
        where: {
          userId_testId: {
            userId: dto.userId,
            testId: dto.testId,
          },
        },
      });

      // 2. Anti-Farming EXP (FR-34): Cairkan EXP hanya saat kelulusan pertama pada Test ini
      let expEarned = 0;
      const shouldAwardExp = passed && !prevProgress?.expAwardedAt;

      if (shouldAwardExp) {
        const rule = await tx.masteryRule.findUnique({ where: { mastery } });
        expEarned = rule ? rule.baseExp + (normalized100 === 100 ? rule.expBonus : 0) : 50;

        if (expEarned > 0) {
          await tx.expTransaction.create({
            data: {
              userId: dto.userId,
              amount: expEarned,
              sourceType: ExpSource.QUIZ,
              sourceId: dto.testId,
            },
          });
        }
      }

      const prevStat = await tx.userStat.findUnique({ where: { userId: dto.userId } });
      const prevTotalExp = prevStat?.totalExp ?? BigInt(0);

      const userStat = await tx.userStat.upsert({
        where: { userId: dto.userId },
        update: {
          totalExp: { increment: BigInt(expEarned) },
        },
        create: {
          userId: dto.userId,
          totalExp: BigInt(expEarned),
          currentStreak: 0,
          longestStreak: 0,
          streakFreezeCount: 0,
          dailyTarget: 0,
        },
      });

      // 3. Catat aktivitas harian (DailyActivity)
      const activityDate = normalizeToUtcDate();
      await tx.dailyActivity.upsert({
        where: {
          userId_activityDate: {
            userId: dto.userId,
            activityDate,
          },
        },
        update: {
          expEarned: { increment: expEarned },
          testsDone: { increment: 1 },
        },
        create: {
          userId: dto.userId,
          activityDate,
          expEarned,
          testsDone: 1,
          loggedIn: true,
          freezeUsed: false,
        },
      });

      // 4. Update ProgressTest
      const bestScoreVal =
        prevProgress && Number(prevProgress.bestScore) > finalScore
          ? prevProgress.bestScore
          : new Prisma.Decimal(finalScore);

      await tx.progressTest.upsert({
        where: {
          userId_testId: {
            userId: dto.userId,
            testId: dto.testId,
          },
        },
        update: {
          bestScore: bestScoreVal,
          bestMastery: mastery,
          attemptsCount: { increment: 1 },
          ...(passed ? {} : { wrongAttemptsCount: { increment: 1 } }),
          status: passed || prevProgress?.status === ProgressStatus.COMPLETED
            ? ProgressStatus.COMPLETED
            : ProgressStatus.FAILED,
          ...(shouldAwardExp ? { expAwardedAt: new Date() } : {}),
        },
        create: {
          userId: dto.userId,
          testId: dto.testId,
          bestScore: new Prisma.Decimal(finalScore),
          bestMastery: mastery,
          attemptsCount: 1,
          wrongAttemptsCount: passed ? 0 : 1,
          status: passed ? ProgressStatus.COMPLETED : ProgressStatus.FAILED,
          expAwardedAt: shouldAwardExp ? new Date() : null,
        },
      });

      // 5. Evaluasi Level User (sebelum vs sesudah pencairan EXP)
      const levels = await tx.level.findMany({ orderBy: { minExp: 'asc' } });
      let prevLevel: { id: string; name: string; minExp: number } | null = null;
      let currentLevel: { id: string; name: string; minExp: number } | null = null;

      for (const lvl of levels) {
        if (BigInt(lvl.minExp) <= prevTotalExp) {
          prevLevel = { id: lvl.id, name: lvl.name, minExp: lvl.minExp };
        }
        if (BigInt(lvl.minExp) <= userStat.totalExp) {
          currentLevel = { id: lvl.id, name: lvl.name, minExp: lvl.minExp };
        }
      }

      const leveledUp = Boolean(
        currentLevel && (!prevLevel || currentLevel.minExp > prevLevel.minExp),
      );

      const totalExpOut =
        userStat.totalExp <= BigInt(Number.MAX_SAFE_INTEGER)
          ? Number(userStat.totalExp)
          : userStat.totalExp.toString();

      return {
        submissionId: submission.id,
        testId: dto.testId,
        finalScore,
        rawScore: clampedRaw,
        rawMax,
        unit: dto.unit ?? null,
        passed,
        mastery,
        expEarned,
        totalExp: totalExpOut,
        currentLevel,
        leveledUp,
        isPreview: false,
      };
    });
  }
}
