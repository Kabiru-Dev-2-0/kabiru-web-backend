import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ExpSource, MasteryLevel, ProgressStatus } from '.prisma/progress-client';
import type { PrismaService } from '../prisma/prisma.service';
import { SubmissionService } from './submission.service';

describe('SubmissionService (v1.1.0)', () => {
  it('FR-35 & FR-33: menormalisasi skor bintang (12 dari 15 -> 80.00) dan mencairkan EXP pada kelulusan pertama', async () => {
    let createdExpTx: Record<string, unknown> | null = null;
    let savedSubmissionAnswer: Record<string, unknown> | null = null;

    const prismaMock = {
      $transaction: async (cb: (tx: unknown) => Promise<unknown>) =>
        cb({
          submission: {
            create: async (args: { data: { answer: Record<string, unknown> } }) => {
              savedSubmissionAnswer = args.data.answer;
              return { id: 'sub-star-1' };
            },
          },
          progressTest: {
            findUnique: async () => null,
            upsert: async () => ({}),
          },
          masteryRule: {
            findUnique: async () => ({
              id: 'rule-adv',
              mastery: MasteryLevel.ADVANCE,
              baseExp: 100,
              expBonus: 25,
              rankPoint: 20,
            }),
          },
          expTransaction: {
            create: async (args: { data: Record<string, unknown> }) => {
              createdExpTx = args.data;
              return { id: 'exp-1', ...args.data };
            },
          },
          userStat: {
            findUnique: async () => ({ userId: 'student-1', totalExp: BigInt(50) }),
            upsert: async () => ({ userId: 'student-1', totalExp: BigInt(150) }),
          },
          dailyActivity: {
            upsert: async () => ({}),
          },
          level: {
            findMany: async () => [
              { id: 'lvl-1', name: 'Pemula', minExp: 0 },
              { id: 'lvl-2', name: 'Penjelajah', minExp: 100 },
            ],
          },
        }),
    } as unknown as PrismaService;

    const service = new SubmissionService(prismaMock);
    const res = await service.submitGameTest({
      userId: 'student-1',
      testId: '11111111-1111-4111-8111-111111111401',
      maxScore: 100,
      rawScore: 12,
      rawMax: 15,
      unit: 'stars',
      durationSeconds: 45,
      answers: { perQuestionStars: [3, 2, 3, 1, 3] },
    });

    assert.equal(res.finalScore, 80);
    assert.equal(res.rawScore, 12);
    assert.equal(res.rawMax, 15);
    assert.equal(res.passed, true);
    assert.equal(res.mastery, MasteryLevel.ADVANCE);
    assert.equal(res.expEarned, 100);
    assert.equal(res.leveledUp, true);
    assert.equal(createdExpTx?.sourceType, ExpSource.QUIZ);
    assert.equal(savedSubmissionAnswer?.unit, 'stars');
  });

  it('FR-34: mencegah farming EXP (expEarned = 0) saat siswa mengulang kuis yang sudah pernah mencairkan EXP', async () => {
    let expTxCreated = false;

    const prismaMock = {
      $transaction: async (cb: (tx: unknown) => Promise<unknown>) =>
        cb({
          submission: {
            create: async () => ({ id: 'sub-repeat-2' }),
          },
          progressTest: {
            findUnique: async () => ({
              userId: 'student-1',
              testId: 'test-1',
              bestScore: 80,
              status: ProgressStatus.COMPLETED,
              expAwardedAt: new Date('2026-11-28T05:00:00Z'),
            }),
            upsert: async () => ({}),
          },
          expTransaction: {
            create: async () => {
              expTxCreated = true;
              return {};
            },
          },
          userStat: {
            findUnique: async () => ({ userId: 'student-1', totalExp: BigInt(150) }),
            upsert: async () => ({ userId: 'student-1', totalExp: BigInt(150) }),
          },
          dailyActivity: {
            upsert: async () => ({}),
          },
          level: {
            findMany: async () => [{ id: 'lvl-2', name: 'Penjelajah', minExp: 100 }],
          },
        }),
    } as unknown as PrismaService;

    const service = new SubmissionService(prismaMock);
    const res = await service.submitGameTest({
      userId: 'student-1',
      testId: 'test-1',
      rawScore: 15,
      rawMax: 15,
      unit: 'stars',
    });

    assert.equal(res.finalScore, 100);
    assert.equal(res.expEarned, 0);
    assert.equal(expTxCreated, false);
  });

  it('OWASP Input Validation: menolak rawMax <= 0 dan men-clamp rawScore yang melebihi rawMax ke batas maksimal', async () => {
    const prismaMock = {
      $transaction: async (cb: (tx: unknown) => Promise<unknown>) =>
        cb({
          submission: { create: async () => ({ id: 'sub-clamp' }) },
          progressTest: {
            findUnique: async () => ({ expAwardedAt: new Date(), bestScore: 100, status: ProgressStatus.COMPLETED }),
            upsert: async () => ({}),
          },
          userStat: {
            findUnique: async () => ({ userId: 'student-1', totalExp: BigInt(100) }),
            upsert: async () => ({ userId: 'student-1', totalExp: BigInt(100) }),
          },
          dailyActivity: { upsert: async () => ({}) },
          level: { findMany: async () => [] },
        }),
    } as unknown as PrismaService;

    const service = new SubmissionService(prismaMock);

    await assert.rejects(async () => {
      await service.submitGameTest({
        userId: 'student-1',
        testId: 'test-1',
        rawScore: 5,
        rawMax: 0,
      });
    });

    const clamped = await service.submitGameTest({
      userId: 'student-1',
      testId: 'test-1',
      maxScore: 100,
      rawScore: 9999,
      rawMax: 15,
    });

    assert.equal(clamped.rawScore, 15);
    assert.equal(clamped.finalScore, 100);
  });
});
