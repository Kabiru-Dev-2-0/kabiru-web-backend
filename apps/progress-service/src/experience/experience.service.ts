import { Injectable, Logger } from '@nestjs/common';
import { MasteryLevel, Prisma } from '.prisma/progress-client';
import { PrismaService } from '../prisma/prisma.service';
import { serializeBigInt } from '../common/bigint.util';
import { createRpcError } from '../common/rpc-exception.util';
import {
  AddExperienceDto,
  CreateMasteryRuleDto,
  GetExpHistoryDto,
} from './dto/add-experience.dto';

@Injectable()
export class ExperienceService {
  private readonly logger = new Logger(ExperienceService.name);

  constructor(private readonly prisma: PrismaService) {}

  async addExperience(dto: AddExperienceDto) {
    if (!dto.userId || dto.amount === undefined || !dto.sourceType || !dto.sourceId) {
      throw createRpcError({
        code: 'VALIDATION_ERROR',
        httpStatus: 400,
        message: 'userId, amount, sourceType, dan sourceId wajib diisi',
      });
    }

    if (dto.amount <= 0) {
      throw createRpcError({
        code: 'INVALID_AMOUNT',
        httpStatus: 400,
        message: 'Jumlah EXP harus bernilai positif',
      });
    }

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 1. Buat record transaksi EXP
      const transaction = await tx.expTransaction.create({
        data: {
          userId: dto.userId,
          amount: dto.amount,
          sourceType: dto.sourceType,
          sourceId: dto.sourceId,
        },
      });

      // 2. Akumulasi total_exp di user_stat (atomic upsert)
      const userStat = await tx.userStat.upsert({
        where: { userId: dto.userId },
        update: {
          totalExp: {
            increment: BigInt(dto.amount),
          },
        },
        create: {
          userId: dto.userId,
          totalExp: BigInt(dto.amount),
          currentStreak: 0,
          longestStreak: 0,
          streakFreezeCount: 0,
          dailyTarget: 0,
        },
      });

      // 3. Evaluasi level user berdasarkan total_exp
      const levels = await tx.level.findMany({
        orderBy: { minExp: 'asc' },
      });

      let level = null;
      for (const candidate of levels) {
        if (BigInt(candidate.minExp) <= userStat.totalExp) {
          level = candidate;
        } else {
          break;
        }
      }

      return {
        transaction,
        userStat: serializeBigInt(userStat),
        currentLevel: level ?? null,
      };
    });
  }

  async getTransactionHistory(dto: GetExpHistoryDto) {
    if (!dto.userId) {
      throw createRpcError({
        code: 'VALIDATION_ERROR',
        httpStatus: 400,
        message: 'userId wajib diisi',
      });
    }

    return this.prisma.expTransaction.findMany({
      where: { userId: dto.userId },
      orderBy: { createdAt: 'desc' },
      take: dto.limit ?? 50,
    });
  }

  async getLevels() {
    return this.prisma.level.findMany({
      orderBy: { minExp: 'asc' },
    });
  }

  async getUserLevel(userId: string) {
    if (!userId) {
      throw createRpcError({
        code: 'VALIDATION_ERROR',
        httpStatus: 400,
        message: 'userId wajib diisi',
      });
    }

    const stat = await this.prisma.userStat.findUnique({
      where: { userId },
    });

    const totalExp = stat?.totalExp ?? BigInt(0);
    const levels = await this.prisma.level.findMany({
      orderBy: { minExp: 'asc' },
    });

    let currentLevel = null;
    let nextLevel = null;
    for (const level of levels) {
      if (BigInt(level.minExp) <= totalExp) {
        currentLevel = level;
      } else {
        nextLevel = level;
        break;
      }
    }

    const expToNext = nextLevel
      ? Number(BigInt(nextLevel.minExp) - totalExp)
      : 0;
    const totalExpOutput = totalExp <= BigInt(Number.MAX_SAFE_INTEGER)
      ? Number(totalExp)
      : totalExp.toString();

    return {
      userId,
      totalExp: totalExpOutput,
      currentLevel: currentLevel ?? null,
      nextLevel: nextLevel ?? null,
      expToNextLevel: expToNext,
    };
  }

  // ==========================================
  // MASTERY RULE (Domain Gamifikasi)
  // ==========================================

  async getMasteryRules() {
    return this.prisma.masteryRule.findMany({
      orderBy: { baseExp: 'asc' },
    });
  }

  async getMasteryRule(mastery: MasteryLevel) {
    return this.prisma.masteryRule.findUnique({
      where: { mastery },
    });
  }

  async createMasteryRule(dto: CreateMasteryRuleDto) {
    if (!dto.mastery || dto.baseExp === undefined || dto.expBonus === undefined || dto.rankPoint === undefined) {
      throw createRpcError({
        code: 'VALIDATION_ERROR',
        httpStatus: 400,
        message: 'mastery, baseExp, expBonus, dan rankPoint wajib diisi',
      });
    }

    return this.prisma.masteryRule.upsert({
      where: { mastery: dto.mastery },
      update: {
        baseExp: dto.baseExp,
        expBonus: dto.expBonus,
        rankPoint: dto.rankPoint,
      },
      create: {
        mastery: dto.mastery,
        baseExp: dto.baseExp,
        expBonus: dto.expBonus,
        rankPoint: dto.rankPoint,
      },
    });
  }
}
