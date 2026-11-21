import 'reflect-metadata';

import {
    beforeAll,
    describe,
    expect,
    mock,
    test,
} from 'bun:test';

mock.module('@nestjs/microservices', () => ({
    MessagePattern: () => () => undefined,
    Payload: () => () => undefined,
    RpcException: class RpcException {
        constructor(private readonly error: unknown) {}

        getError() {
        return this.error;
        }
    },
}));

let leaderboardQuerySchema: typeof import('@kabiru/contracts').leaderboardQuerySchema;
let LeaderboardService: typeof import('./leaderboard.service').LeaderboardService;
let getCurrentUtcWeekRange: typeof import('./leaderboard.service').getCurrentUtcWeekRange;
let LeaderboardController: typeof import('./leaderboard.controller').LeaderboardController;

beforeAll(async () => {
    ({ leaderboardQuerySchema } = await import('@kabiru/contracts'));
    ({ LeaderboardService, getCurrentUtcWeekRange } =
        await import('./leaderboard.service'));
    ({ LeaderboardController } =
    await import('./leaderboard.controller'));
});

describe('Leaderboard Query Schema', () => {
    test('should use default pagination', () => {
    expect(
        leaderboardQuerySchema.parse({}),
    ).toEqual({
        page: 1,
        limit: 20,
    });
    });

    test('should accept valid pagination', () => {
    expect(
        leaderboardQuerySchema.parse({
        page: '2',
        limit: '50',
        }),
    ).toEqual({
        page: 2,
        limit: 50,
    });
    });

    test('should reject page below 1', () => {
    expect(() =>
        leaderboardQuerySchema.parse({
        page: '0',
        limit: '10',
        }),
    ).toThrow();
    });

    test('should reject limit above 100', () => {
    expect(() =>
        leaderboardQuerySchema.parse({
        page: '1',
        limit: '101',
        }),
    ).toThrow();
    });

    test('should use defaults for empty pagination values', () => {
    expect(
        leaderboardQuerySchema.parse({ page: '', limit: '' }),
    ).toEqual({ page: 1, limit: 20 });
    });
});

describe('getCurrentUtcWeekRange', () => {
    test('starts Monday at 00:00 UTC', () => {
        const range = getCurrentUtcWeekRange(
        new Date('2026-11-23T12:30:00Z'),
        );
        expect(range.startAt.toISOString()).toBe('2026-11-23T00:00:00.000Z');
        expect(range.endAt.toISOString()).toBe('2026-11-30T00:00:00.000Z');
    });

    test('maps Sunday to the current Monday week', () => {
        const range = getCurrentUtcWeekRange(
        new Date('2026-11-22T23:59:59Z'),
        );
        expect(range.startAt.toISOString()).toBe('2026-11-16T00:00:00.000Z');
        expect(range.endAt.toISOString()).toBe('2026-11-23T00:00:00.000Z');
    });

    test('handles month and year boundaries', () => {
        const range = getCurrentUtcWeekRange(
        new Date('2027-01-01T00:00:00Z'),
        );
        expect(range.startAt.toISOString()).toBe('2026-12-28T00:00:00.000Z');
        expect(range.endAt.toISOString()).toBe('2027-01-04T00:00:00.000Z');
    });
});

describe('LeaderboardService', () => {
    test('returns an empty leaderboard', async () => {
        const prisma = { $queryRaw: async () => [] };
        const service = new LeaderboardService(prisma as never);

        await expect(
        service.getWeeklyLeaderboard({ page: 1, limit: 20 }),
        ).resolves.toEqual({
        items: [],
        pagination: {
            page: 1,
            limit: 20,
            totalItems: 0,
            totalPages: 0,
        },
        });
    });

    test('supports tie ranking, pagination, and BigInt conversion', async () => {
        const prisma = {
        $queryRaw: async () => [
            { user_id: 'user-b', weekly_exp: 100n, position: 1n, total_items: 3n },
            { user_id: 'user-c', weekly_exp: 50n, position: 3n, total_items: 3n },
        ],
        };
        const service = new LeaderboardService(prisma as never);

        expect(
        await service.getWeeklyLeaderboard({ page: 2, limit: 2 }),
        ).toEqual({
        items: [
            { userId: 'user-b', position: 1, weeklyExp: '100' },
            { userId: 'user-c', position: 3, weeklyExp: '50' },
        ],
        pagination: {
            page: 2,
            limit: 2,
            totalItems: 3,
            totalPages: 2,
        },
        });
    });
});

describe('LeaderboardController', () => {
    test('rejects unauthenticated requests', async () => {
        const controller = new LeaderboardController({
        getWeeklyLeaderboard: async () => ({
            items: [],
            pagination: { page: 1, limit: 20, totalItems: 0, totalPages: 0 },
        }),
        } as never);

        try {
        await controller.getLeaderboard({ data: {}, meta: {} });
        throw new Error('Expected unauthenticated request to fail');
        } catch (error) {
        const rpcError = (error as { getError(): unknown }).getError() as {
            httpStatus: number;
        };
        expect(rpcError.httpStatus).toBe(401);
        }
    });

    test('rejects invalid query parameters', async () => {
        const controller = new LeaderboardController({
        getWeeklyLeaderboard: async () => ({
            items: [],
            pagination: { page: 1, limit: 20, totalItems: 0, totalPages: 0 },
        }),
        } as never);

        try {
        await controller.getLeaderboard({
            data: { page: 0, limit: 101 },
            meta: { actor: { userId: 'user-1' } },
        });
        throw new Error('Expected invalid pagination to fail');
        } catch (error) {
        const rpcError = (error as { getError(): unknown }).getError() as {
            httpStatus: number;
        };
        expect(rpcError.httpStatus).toBe(400);
        }
    });
});