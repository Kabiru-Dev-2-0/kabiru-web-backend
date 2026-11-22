import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { PrismaService } from '../prisma/prisma.service';
import { StreakService } from './streak.service';

describe('StreakService', () => {
  it('menginisialisasi streak ke 1 untuk user baru', async () => {
    let capturedCreateData: any;

    const prismaMock = {
      $transaction: async (cb: any) => {
        return cb({
          userStat: {
            findUnique: async () => null,
            create: async (args: any) => {
              capturedCreateData = args.data;
              return {
                ...args.data,
                updatedAt: new Date(),
              };
            },
          },
        });
      },
    } as unknown as PrismaService;

    const service = new StreakService(prismaMock);
    const result = await service.updateStreakOnActivity({
      userId: 'user-1',
      activityDate: new Date('2026-11-20T00:00:00Z'),
    });

    assert.equal(capturedCreateData.currentStreak, 1);
    assert.equal(capturedCreateData.longestStreak, 1);
    assert.equal(result.currentStreak, 1);
  });

  it('tidak mengubah streak jika aktivitas dilakukan pada hari yang sama', async () => {
    const today = new Date('2026-11-20T00:00:00Z');

    const prismaMock = {
      $transaction: async (cb: any) => {
        return cb({
          userStat: {
            findUnique: async () => ({
              userId: 'user-1',
              totalExp: BigInt(100),
              currentStreak: 3,
              longestStreak: 5,
              lastActivityDate: today,
              streakFreezeCount: 1,
              dailyTarget: 50,
              updatedAt: new Date(),
            }),
          },
        });
      },
    } as unknown as PrismaService;

    const service = new StreakService(prismaMock);
    const result = await service.updateStreakOnActivity({
      userId: 'user-1',
      activityDate: today,
    });

    assert.equal(result.currentStreak, 3);
    assert.equal(result.longestStreak, 5);
  });

  it('menambah streak 1 jika aktivitas pada hari berikutnya (consecutive)', async () => {
    const yesterday = new Date('2026-11-19T00:00:00Z');
    const today = new Date('2026-11-20T00:00:00Z');

    let updatedData: any;

    const prismaMock = {
      $transaction: async (cb: any) => {
        return cb({
          userStat: {
            findUnique: async () => ({
              userId: 'user-1',
              totalExp: BigInt(100),
              currentStreak: 3,
              longestStreak: 3,
              lastActivityDate: yesterday,
              streakFreezeCount: 1,
              dailyTarget: 50,
              updatedAt: new Date(),
            }),
            update: async (args: any) => {
              updatedData = args.data;
              return {
                userId: 'user-1',
                totalExp: BigInt(100),
                currentStreak: args.data.currentStreak,
                longestStreak: args.data.longestStreak,
                lastActivityDate: args.data.lastActivityDate,
                streakFreezeCount: 1,
                dailyTarget: 50,
                updatedAt: new Date(),
              };
            },
          },
        });
      },
    } as unknown as PrismaService;

    const service = new StreakService(prismaMock);
    const result = await service.updateStreakOnActivity({
      userId: 'user-1',
      activityDate: today,
    });

    assert.equal(updatedData.currentStreak, 4);
    assert.equal(updatedData.longestStreak, 4);
    assert.equal(result.currentStreak, 4);
  });

  it('menggunakan streak freeze jika terlewat hari dan freeze count tersedia', async () => {
    const twoDaysAgo = new Date('2026-11-18T00:00:00Z');
    const today = new Date('2026-11-20T00:00:00Z');

    let updatedData: any;
    let dailyActivityCreated: any;

    const prismaMock = {
      $transaction: async (cb: any) => {
        return cb({
          userStat: {
            findUnique: async () => ({
              userId: 'user-1',
              totalExp: BigInt(100),
              currentStreak: 5,
              longestStreak: 5,
              lastActivityDate: twoDaysAgo,
              streakFreezeCount: 2,
              dailyTarget: 50,
              updatedAt: new Date(),
            }),
            update: async (args: any) => {
              updatedData = args.data;
              return {
                userId: 'user-1',
                totalExp: BigInt(100),
                ...args.data,
                updatedAt: new Date(),
              };
            },
          },
          dailyActivity: {
            upsert: async (args: any) => {
              dailyActivityCreated = args.create;
            },
          },
        });
      },
    } as unknown as PrismaService;

    const service = new StreakService(prismaMock);
    const result = await service.updateStreakOnActivity({
      userId: 'user-1',
      activityDate: today,
    });

    assert.equal(updatedData.currentStreak, 5);
    assert.equal(updatedData.streakFreezeCount, 1);
    assert.equal(result.currentStreak, 5);
  });

  it('mereset streak ke 1 jika terlewat hari dan tidak memiliki freeze', async () => {
    const twoDaysAgo = new Date('2026-11-18T00:00:00Z');
    const today = new Date('2026-11-20T00:00:00Z');

    let updatedData: any;

    const prismaMock = {
      $transaction: async (cb: any) => {
        return cb({
          userStat: {
            findUnique: async () => ({
              userId: 'user-1',
              totalExp: BigInt(100),
              currentStreak: 5,
              longestStreak: 5,
              lastActivityDate: twoDaysAgo,
              streakFreezeCount: 0,
              dailyTarget: 50,
              updatedAt: new Date(),
            }),
            update: async (args: any) => {
              updatedData = args.data;
              return {
                userId: 'user-1',
                totalExp: BigInt(100),
                ...args.data,
                longestStreak: 5,
                streakFreezeCount: 0,
                dailyTarget: 50,
                updatedAt: new Date(),
              };
            },
          },
        });
      },
    } as unknown as PrismaService;

    const service = new StreakService(prismaMock);
    const result = await service.updateStreakOnActivity({
      userId: 'user-1',
      activityDate: today,
    });

    assert.equal(updatedData.currentStreak, 1);
    assert.equal(result.currentStreak, 1);
  });
});
