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
