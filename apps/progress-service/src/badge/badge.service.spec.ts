import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { PrismaService } from '../prisma/prisma.service';
import { BadgeProgressService } from './badge.service';

describe('BadgeProgressService', () => {
  it('menolak nilai progress negatif dan targetValue tidak positif', async () => {
    const service = new BadgeProgressService({} as PrismaService);

    await assert.rejects(
      service.updateBadgeProgress({
        userId: 'user-1',
        badgeId: 'badge-1',
        incrementValue: -1,
      }),
      (error: any) => error?.getError?.().code === 'VALIDATION_ERROR',
    );

    await assert.rejects(
      service.updateBadgeProgress({
        userId: 'user-1',
        badgeId: 'badge-1',
        setValue: 1,
        targetValue: 0,
      }),
      (error: any) => error?.getError?.().code === 'VALIDATION_ERROR',
    );
  });
});
