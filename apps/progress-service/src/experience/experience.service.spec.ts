import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ExpSource, MasteryLevel } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { ExperienceService } from './experience.service';

describe('ExperienceService', () => {
  it('berhasil menambahkan exp_transaction dan mengakumulasikan user_stat.total_exp', async () => {
    let capturedTx: any;
    let capturedStatUpdate: any;

    const prismaMock = {
      $transaction: async (cb: any) => {
        return cb({
          expTransaction: {
            create: async (args: any) => {
              capturedTx = args.data;
              return { id: 'tx-1', ...args.data, createdAt: new Date() };
            },
          },
          userStat: {
            upsert: async (args: any) => {
              capturedStatUpdate = args.update;
              return {
                userId: args.where.userId,
                totalExp: BigInt(150),
                currentStreak: 2,
                longestStreak: 2,
                lastActivityDate: new Date(),
                streakFreezeCount: 0,
                dailyTarget: 0,
                updatedAt: new Date(),
              };
            },
          },
          level: {
            findMany: async () => [
              {
                id: 'lvl-1',
                name: 'Level 1',
                minExp: 100,
                iconAssetId: null,
              },
            ],
          },
        });
      },
    } as unknown as PrismaService;

    const service = new ExperienceService(prismaMock);
    const result = await service.addExperience({
      userId: 'user-1',
      amount: 50,
      sourceType: ExpSource.QUIZ,
      sourceId: 'test-1',
    });

    assert.equal(capturedTx.amount, 50);
    assert.equal(capturedTx.sourceType, ExpSource.QUIZ);
    assert.equal(result.userStat.totalExp, '150');
    assert.equal(result.currentLevel?.name, 'Level 1');
  });

  it('menolak penambahan EXP dengan nilai nol atau negatif', async () => {
    const prismaMock = {} as unknown as PrismaService;
    const service = new ExperienceService(prismaMock);

    await assert.rejects(
      async () => {
        await service.addExperience({
          userId: 'user-1',
          amount: 0,
          sourceType: ExpSource.QUIZ,
          sourceId: 'test-1',
        });
      },
      (err: any) => {
        const error = err?.getError?.() ?? err;
        return error.code === 'INVALID_AMOUNT';
      },
    );
  });

  it('berhasil mengelola konfigurasi mastery_rule dalam modul experience', async () => {
    let upsertPayload: any;

    const prismaMock = {
      masteryRule: {
        upsert: async (args: any) => {
          upsertPayload = args.create;
          return {
            id: 'rule-1',
            ...args.create,
          };
        },
        findUnique: async (args: any) => ({
          id: 'rule-1',
          mastery: args.where.mastery,
          baseExp: 20,
          expBonus: 5,
          rankPoint: 15,
        }),
      },
    } as unknown as PrismaService;

    const service = new ExperienceService(prismaMock);
    const created = await service.createMasteryRule({
      mastery: MasteryLevel.BEGINNER,
      baseExp: 20,
      expBonus: 5,
      rankPoint: 15,
    });

    assert.equal(upsertPayload.mastery, MasteryLevel.BEGINNER);
    assert.equal(created.baseExp, 20);

    const fetched = await service.getMasteryRule(MasteryLevel.BEGINNER);
    assert.equal(fetched?.mastery, MasteryLevel.BEGINNER);
  });

  it('tidak mengubah totalExp besar menjadi Number saat menghitung level', async () => {
    const prismaMock = {
      userStat: {
        findUnique: async () => ({
          userId: 'user-1',
          totalExp: BigInt('9007199254740993'),
        }),
      },
      level: {
        findMany: async () => [
          { id: 'lvl-1', name: 'Beginner', minExp: 0, iconAssetId: null },
          { id: 'lvl-2', name: 'Intermediate', minExp: 100, iconAssetId: null },
        ],
      },
    } as unknown as PrismaService;

    const service = new ExperienceService(prismaMock);
    const result = await service.getUserLevel('user-1');

    assert.equal(result.totalExp, '9007199254740993');
    assert.equal(result.currentLevel?.name, 'Intermediate');
  });
});
