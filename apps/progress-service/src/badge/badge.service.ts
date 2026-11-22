import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { createRpcError } from '../common/rpc-exception.util';
import { AwardBadgeDto, UpdateBadgeProgressDto } from './dto/update-badge-progress.dto';

@Injectable()
export class BadgeProgressService {
  private readonly logger = new Logger(BadgeProgressService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getBadgeProgress(userId: string, badgeId: string) {
    if (!userId || !badgeId) {
      throw createRpcError({
        code: 'VALIDATION_ERROR',
        httpStatus: 400,
        message: 'userId dan badgeId wajib diisi',
      });
    }

    const progress = await this.prisma.progressBadge.findUnique({
      where: {
        userId_badgeId: {
          userId,
          badgeId,
        },
      },
    });

    const isAwarded = await this.prisma.userBadge.findUnique({
      where: {
        userId_badgeId: {
          userId,
          badgeId,
        },
      },
    });

    return {
      userId,
      badgeId,
      currentValue: progress?.currentValue ?? 0,
      targetValue: progress?.targetValue ?? 0,
      isAwarded: !!isAwarded,
      awardedAt: isAwarded?.awardedAt ?? null,
      updatedAt: progress?.updatedAt ?? null,
    };
  }

  async getUserBadges(userId: string) {
    if (!userId) {
      throw createRpcError({
        code: 'VALIDATION_ERROR',
        httpStatus: 400,
        message: 'userId wajib diisi',
      });
    }

    return this.prisma.userBadge.findMany({
      where: { userId },
      orderBy: { awardedAt: 'desc' },
    });
  }

  async updateBadgeProgress(dto: UpdateBadgeProgressDto) {
    if (!dto.userId || !dto.badgeId) {
      throw createRpcError({
        code: 'VALIDATION_ERROR',
        httpStatus: 400,
        message: 'userId dan badgeId wajib diisi',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.progressBadge.findUnique({
        where: {
          userId_badgeId: {
            userId: dto.userId,
            badgeId: dto.badgeId,
          },
        },
      });

      let nextCurrent = 0;
      if (dto.setValue !== undefined) {
        nextCurrent = dto.setValue;
      } else {
        nextCurrent = (existing?.currentValue ?? 0) + (dto.incrementValue ?? 1);
      }

      const targetValue = dto.targetValue ?? existing?.targetValue ?? 100;

      const progress = await tx.progressBadge.upsert({
        where: {
          userId_badgeId: {
            userId: dto.userId,
            badgeId: dto.badgeId,
          },
        },
        update: {
          currentValue: nextCurrent,
          targetValue,
        },
        create: {
          userId: dto.userId,
          badgeId: dto.badgeId,
          currentValue: nextCurrent,
          targetValue,
        },
      });

      // Evaluasi apakah kriteria tercapai dan badge belum pernah diberikan
      let newlyAwarded = false;
      if (nextCurrent >= targetValue) {
        const alreadyAwarded = await tx.userBadge.findUnique({
          where: {
            userId_badgeId: {
              userId: dto.userId,
              badgeId: dto.badgeId,
            },
          },
        });

        if (!alreadyAwarded) {
          await tx.userBadge.create({
            data: {
              userId: dto.userId,
              badgeId: dto.badgeId,
            },
          });
          newlyAwarded = true;
        }
      }

      return {
        progress,
        newlyAwarded,
      };
    });
  }

  async awardBadgeDirectly(dto: AwardBadgeDto) {
    if (!dto.userId || !dto.badgeId) {
      throw createRpcError({
        code: 'VALIDATION_ERROR',
        httpStatus: 400,
        message: 'userId dan badgeId wajib diisi',
      });
    }

    // Idempotent award: jangan double reward jika badge sudah dimiliki
    const existing = await this.prisma.userBadge.findUnique({
      where: {
        userId_badgeId: {
          userId: dto.userId,
          badgeId: dto.badgeId,
        },
      },
    });

    if (existing) {
      return {
        awarded: false,
        message: 'Badge sudah pernah diperoleh sebelumnya',
        userBadge: existing,
      };
    }

    const created = await this.prisma.userBadge.create({
      data: {
        userId: dto.userId,
        badgeId: dto.badgeId,
      },
    });

    return {
      awarded: true,
      message: 'Badge berhasil diberikan',
      userBadge: created,
    };
  }
}
