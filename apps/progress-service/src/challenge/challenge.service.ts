import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeToUtcDate } from '../common/date.util';
import { createRpcError } from '../common/rpc-exception.util';
import {
  GetChallengeProgressDto,
  UpdateChallengeProgressDto,
} from './dto/update-challenge-progress.dto';

@Injectable()
export class ChallengeProgressService {
  private readonly logger = new Logger(ChallengeProgressService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getProgress(dto: GetChallengeProgressDto) {
    if (!dto.userId || !dto.challengeId || !dto.periodStart) {
      throw createRpcError({
        code: 'VALIDATION_ERROR',
        httpStatus: 400,
        message: 'userId, challengeId, dan periodStart wajib diisi',
      });
    }

    const periodStart = normalizeToUtcDate(dto.periodStart);

    const record = await this.prisma.progressChallenge.findUnique({
      where: {
        userId_challengeId_periodStart: {
          userId: dto.userId,
          challengeId: dto.challengeId,
          periodStart,
        },
      },
    });

    if (!record) {
      return {
        userId: dto.userId,
        challengeId: dto.challengeId,
        periodStart,
        currentValue: 0,
        bestValue: 0,
        updatedAt: new Date(),
      };
    }

    return record;
  }

  async getUserChallenges(userId: string) {
    if (!userId) {
      throw createRpcError({
        code: 'VALIDATION_ERROR',
        httpStatus: 400,
        message: 'userId wajib diisi',
      });
    }

    return this.prisma.progressChallenge.findMany({
      where: { userId },
      orderBy: { periodStart: 'desc' },
    });
  }

  async updateProgress(dto: UpdateChallengeProgressDto) {
    if (!dto.userId || !dto.challengeId || !dto.periodStart) {
      throw createRpcError({
        code: 'VALIDATION_ERROR',
        httpStatus: 400,
        message: 'userId, challengeId, dan periodStart wajib diisi',
      });
    }

    const periodStart = normalizeToUtcDate(dto.periodStart);

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.progressChallenge.findUnique({
        where: {
          userId_challengeId_periodStart: {
            userId: dto.userId,
            challengeId: dto.challengeId,
            periodStart,
          },
        },
      });

      let nextCurrentValue = 0;
      if (dto.setValue !== undefined) {
        nextCurrentValue = dto.setValue;
      } else {
        nextCurrentValue = (existing?.currentValue ?? 0) + (dto.incrementValue ?? 1);
      }

      const nextBestValue = Math.max(existing?.bestValue ?? 0, nextCurrentValue);

      return tx.progressChallenge.upsert({
        where: {
          userId_challengeId_periodStart: {
            userId: dto.userId,
            challengeId: dto.challengeId,
            periodStart,
          },
        },
        update: {
          currentValue: nextCurrentValue,
          bestValue: nextBestValue,
        },
        create: {
          userId: dto.userId,
          challengeId: dto.challengeId,
          periodStart,
          currentValue: nextCurrentValue,
          bestValue: nextBestValue,
        },
      });
    });
  }
}
