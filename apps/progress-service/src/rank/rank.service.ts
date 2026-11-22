import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { createRpcError } from '../common/rpc-exception.util';
import { CreateRankTierDto, UpdateRankDto } from './dto/update-rank.dto';

@Injectable()
export class RankService {
  private readonly logger = new Logger(RankService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getUserRank(userId: string, menu: string) {
    if (!userId || !menu) {
      throw createRpcError({
        code: 'VALIDATION_ERROR',
        httpStatus: 400,
        message: 'userId dan menu wajib diisi',
      });
    }

    return this.prisma.userRank.findUnique({
      where: {
        userId_menu: {
          userId,
          menu,
        },
      },
      include: {
        rankTier: true,
      },
    });
  }

  async getUserRanks(userId: string) {
    if (!userId) {
      throw createRpcError({
        code: 'VALIDATION_ERROR',
        httpStatus: 400,
        message: 'userId wajib diisi',
      });
    }

    return this.prisma.userRank.findMany({
      where: { userId },
      include: {
        rankTier: true,
      },
      orderBy: {
        averagePoint: 'desc',
      },
    });
  }

  async getRankTiers() {
    return this.prisma.rankTier.findMany({
      orderBy: { minAveragePoint: 'asc' },
    });
  }

  async createRankTier(dto: CreateRankTierDto) {
    if (!dto.name || dto.minAveragePoint === undefined || dto.maxAveragePoint === undefined) {
      throw createRpcError({
        code: 'VALIDATION_ERROR',
        httpStatus: 400,
        message: 'name, minAveragePoint, dan maxAveragePoint wajib diisi',
      });
    }

    if (
      !Number.isFinite(dto.minAveragePoint) ||
      !Number.isFinite(dto.maxAveragePoint) ||
      dto.minAveragePoint < 0 ||
      dto.maxAveragePoint > 100 ||
      dto.minAveragePoint > dto.maxAveragePoint
    ) {
      throw createRpcError({
        code: 'VALIDATION_ERROR',
        httpStatus: 400,
        message: 'Rentang rank tier harus berada dalam 0–100 dan minimum tidak boleh melebihi maksimum',
      });
    }

    const existing = await this.prisma.rankTier.findMany({
      orderBy: { minAveragePoint: 'asc' },
    });
    const candidate = {
      min: Math.round(dto.minAveragePoint * 100),
      max: Math.round(dto.maxAveragePoint * 100),
    };

    const intervals = [
      ...existing.map((tier) => ({
        min: Math.round(Number(tier.minAveragePoint) * 100),
        max: Math.round(Number(tier.maxAveragePoint) * 100),
      })),
      candidate,
    ].sort((a, b) => a.min - b.min);

    for (let index = 0; index < intervals.length; index += 1) {
      const interval = intervals[index];
      if (interval.min === candidate.min && interval.max === candidate.max) {
        const matches = intervals.filter(
          (item) => item.min === candidate.min && item.max === candidate.max,
        );
        if (matches.length > 1) {
          throw createRpcError({
            code: 'RANK_TIER_OVERLAP',
            httpStatus: 409,
            message: 'Rank tier baru tumpang tindih dengan rank tier yang sudah ada',
          });
        }
      }

      if (index > 0) {
        const previous = intervals[index - 1];
        if (interval.min <= previous.max) {
          throw createRpcError({
            code: 'RANK_TIER_OVERLAP',
            httpStatus: 409,
            message: 'Rank tier baru tumpang tindih dengan rank tier yang sudah ada',
          });
        }
        if (interval.min > previous.max + 1) {
          throw createRpcError({
            code: 'RANK_TIER_GAP',
            httpStatus: 409,
            message: 'Rank tier tidak boleh meninggalkan gap pada rentang 0–100',
          });
        }
      }
    }

    if (intervals[0].min !== 0 || intervals[intervals.length - 1].max !== 10000) {
      throw createRpcError({
        code: 'RANK_TIER_GAP',
        httpStatus: 409,
        message: 'Rank tier harus mencakup rentang 0–100 tanpa gap',
      });
    }

    return this.prisma.rankTier.create({
      data: {
        name: dto.name,
        minAveragePoint: dto.minAveragePoint,
        maxAveragePoint: dto.maxAveragePoint,
      },
    });
  }

  async updateUserRank(dto: UpdateRankDto) {
    if (!dto.userId || !dto.menu || dto.averagePoint === undefined) {
      throw createRpcError({
        code: 'VALIDATION_ERROR',
        httpStatus: 400,
        message: 'userId, menu, dan averagePoint wajib diisi',
      });
    }

    if (
      !Number.isFinite(dto.averagePoint) ||
      dto.averagePoint < 0 ||
      dto.averagePoint > 100
    ) {
      throw createRpcError({
        code: 'VALIDATION_ERROR',
        httpStatus: 400,
        message: 'averagePoint harus berada dalam rentang 0–100',
      });
    }

    // Cari rank tier yang cocok berdasarkan rentang point rata-rata
    const matchedTier = await this.prisma.rankTier.findFirst({
      where: {
        minAveragePoint: {
          lte: dto.averagePoint,
        },
        maxAveragePoint: {
          gte: dto.averagePoint,
        },
      },
    });

    if (!matchedTier) {
      throw createRpcError({
        code: 'RANK_TIER_NOT_FOUND',
        httpStatus: 404,
        message: `Tidak ditemukan rank tier yang sesuai untuk nilai rata-rata: ${dto.averagePoint}`,
      });
    }

    return this.prisma.userRank.upsert({
      where: {
        userId_menu: {
          userId: dto.userId,
          menu: dto.menu,
        },
      },
      update: {
        averagePoint: dto.averagePoint,
        rankTierId: matchedTier.id,
      },
      create: {
        userId: dto.userId,
        menu: dto.menu,
        averagePoint: dto.averagePoint,
        rankTierId: matchedTier.id,
      },
      include: {
        rankTier: true,
      },
    });
  }
}
