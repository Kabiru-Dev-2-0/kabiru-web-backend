import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Prisma } from '.prisma/progress-client';
import type { PrismaService } from '../prisma/prisma.service';
import { RankService } from './rank.service';

describe('RankService', () => {
  it('menolak rank tier dengan rentang overlap', async () => {
    const prismaMock = {
      rankTier: {
        findMany: async () => [
          {
            minAveragePoint: new Prisma.Decimal(0),
            maxAveragePoint: new Prisma.Decimal('59.99'),
          },
          {
            minAveragePoint: new Prisma.Decimal(60),
            maxAveragePoint: new Prisma.Decimal(100),
          },
        ],
      },
    } as unknown as PrismaService;
    const service = new RankService(prismaMock);

    await assert.rejects(
      service.createRankTier({
        name: 'Overlap',
        minAveragePoint: 50,
        maxAveragePoint: 70,
      }),
      (error: any) => error?.getError?.().code === 'RANK_TIER_OVERLAP',
    );
  });

  it('menolak averagePoint di luar rentang 0 sampai 100', async () => {
    const service = new RankService({} as PrismaService);

    await assert.rejects(
      service.updateUserRank({
        userId: 'user-1',
        menu: 'PYTHON',
        averagePoint: 101,
      }),
      (error: any) => error?.getError?.().code === 'VALIDATION_ERROR',
    );
  });
});
