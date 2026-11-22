import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { PrismaService } from '../prisma/prisma.service';
import { ChallengeProgressService } from './challenge.service';

describe('ChallengeProgressService', () => {
  it('menolak increment dan setValue negatif', async () => {
    const service = new ChallengeProgressService({} as PrismaService);

    await assert.rejects(
      service.updateProgress({
        userId: 'user-1',
        challengeId: 'challenge-1',
        periodStart: '2026-11-22',
        incrementValue: -1,
      }),
      (error: any) => error?.getError?.().code === 'VALIDATION_ERROR',
    );

    await assert.rejects(
      service.updateProgress({
        userId: 'user-1',
        challengeId: 'challenge-1',
        periodStart: '2026-11-22',
        setValue: -1,
      }),
      (error: any) => error?.getError?.().code === 'VALIDATION_ERROR',
    );
  });
});
