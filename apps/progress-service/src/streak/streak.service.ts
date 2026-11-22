import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '.prisma/progress-client';
import { PrismaService } from '../prisma/prisma.service';
import { getDaysDifference, normalizeToUtcDate } from '../common/date.util';
import { serializeBigInt } from '../common/bigint.util';
import { createRpcError } from '../common/rpc-exception.util';
import {
  AddStreakFreezeDto,
  SetDailyTargetDto,
  UpdateStreakDto,
} from './dto/update-streak.dto';

@Injectable()
export class StreakService {
  private readonly logger = new Logger(StreakService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getUserStat(userId: string) {
    if (!userId) {
      throw createRpcError({
        code: 'VALIDATION_ERROR',
        httpStatus: 400,
        message: 'userId wajib diisi',
      });
    }

    let stat = await this.prisma.userStat.findUnique({
      where: { userId },
    });

    if (!stat) {
      stat = await this.prisma.userStat.create({
        data: {
          userId,
          totalExp: BigInt(0),
          currentStreak: 0,
          longestStreak: 0,
          streakFreezeCount: 0,
          dailyTarget: 0,
        },
      });
    }

    return serializeBigInt(stat);
  }

  async updateStreakOnActivity(dto: UpdateStreakDto) {
    if (!dto.userId) {
      throw createRpcError({
        code: 'VALIDATION_ERROR',
        httpStatus: 400,
        message: 'userId wajib diisi',
      });
    }

    const today = normalizeToUtcDate(dto.activityDate);

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      let stat = await tx.userStat.findUnique({
        where: { userId: dto.userId },
      });

      if (!stat) {
        stat = await tx.userStat.create({
          data: {
            userId: dto.userId,
            totalExp: BigInt(0),
            currentStreak: 1,
            longestStreak: 1,
            lastActivityDate: today,
            streakFreezeCount: 0,
            dailyTarget: 0,
          },
        });
        return serializeBigInt(stat);
      }

      // Jika belum ada lastActivityDate, inisialisasi streak ke 1
      if (!stat.lastActivityDate) {
        const updated = await tx.userStat.update({
          where: { userId: dto.userId },
          data: {
            currentStreak: 1,
            longestStreak: Math.max(stat.longestStreak, 1),
            lastActivityDate: today,
          },
        });
        return serializeBigInt(updated);
      }

      const diffDays = getDaysDifference(stat.lastActivityDate, today);

      if (diffDays === 0) {
        // Hari yang sama: streak tidak berubah
        return serializeBigInt(stat);
      } else if (diffDays === 1) {
        // Hari berikutnya (berurutan): streak bertambah 1
        const newCurrent = stat.currentStreak + 1;
        const newLongest = Math.max(stat.longestStreak, newCurrent);

        const updated = await tx.userStat.update({
          where: { userId: dto.userId },
          data: {
            currentStreak: newCurrent,
            longestStreak: newLongest,
            lastActivityDate: today,
          },
        });
        return serializeBigInt(updated);
      } else {
        // Terlewat lebih dari 1 hari: periksa apakah ada streak freeze yang tersedia
        if (stat.streakFreezeCount > 0) {
          // Gunakan 1 freeze dan pertahankan streak saat ini
          const newLongest = Math.max(stat.longestStreak, stat.currentStreak);

          // Tandai freeze_used pada daily_activity hari ini
          await tx.dailyActivity.upsert({
            where: {
              userId_activityDate: {
                userId: dto.userId,
                activityDate: today,
              },
            },
            update: {
              freezeUsed: true,
            },
            create: {
              userId: dto.userId,
              activityDate: today,
              freezeUsed: true,
            },
          });

          const updated = await tx.userStat.update({
            where: { userId: dto.userId },
            data: {
              currentStreak: stat.currentStreak,
              longestStreak: newLongest,
              lastActivityDate: today,
              streakFreezeCount: stat.streakFreezeCount - 1,
            },
          });
          return serializeBigInt(updated);
        } else {
          // Tidak ada freeze: reset streak ke 1
          const updated = await tx.userStat.update({
            where: { userId: dto.userId },
            data: {
              currentStreak: 1,
              lastActivityDate: today,
            },
          });
          return serializeBigInt(updated);
        }
      }
    });
  }

  async addStreakFreeze(dto: AddStreakFreezeDto) {
    if (!dto.userId || dto.count === undefined || dto.count <= 0) {
      throw createRpcError({
        code: 'VALIDATION_ERROR',
        httpStatus: 400,
        message: 'userId dan count positif wajib diisi',
      });
    }

    const updated = await this.prisma.userStat.upsert({
      where: { userId: dto.userId },
      update: {
        streakFreezeCount: {
          increment: dto.count,
        },
      },
      create: {
        userId: dto.userId,
        totalExp: BigInt(0),
        currentStreak: 0,
        longestStreak: 0,
        streakFreezeCount: dto.count,
        dailyTarget: 0,
      },
    });

    return serializeBigInt(updated);
  }

  async setDailyTarget(dto: SetDailyTargetDto) {
    if (!dto.userId || dto.dailyTarget === undefined || dto.dailyTarget < 0) {
      throw createRpcError({
        code: 'VALIDATION_ERROR',
        httpStatus: 400,
        message: 'userId dan dailyTarget valid wajib diisi',
      });
    }

    const updated = await this.prisma.userStat.upsert({
      where: { userId: dto.userId },
      update: {
        dailyTarget: dto.dailyTarget,
      },
      create: {
        userId: dto.userId,
        totalExp: BigInt(0),
        currentStreak: 0,
        longestStreak: 0,
        streakFreezeCount: 0,
        dailyTarget: dto.dailyTarget,
      },
    });

    return serializeBigInt(updated);
  }
}
