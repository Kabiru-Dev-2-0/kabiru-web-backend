import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import type {
  LeaderboardQueryDto,
  LeaderboardResultDto,
} from '@kabiru/contracts';

interface LeaderboardSqlRow {
  user_id: string | null;
  weekly_exp: bigint | null;
  position: bigint | null;
  total_items: bigint;
}

export function getCurrentUtcWeekRange(now = new Date()) {
  const start = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
    ),
  );

  // JavaScript: Sunday = 0, Monday = 1.
  const daysSinceMonday = (start.getUTCDay() + 6) % 7;

  start.setUTCDate(start.getUTCDate() - daysSinceMonday);

  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);

  return {
    startAt: start,
    endAt: end,
  };
}

@Injectable()
export class LeaderboardService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async getWeeklyLeaderboard(
    query: LeaderboardQueryDto,
  ): Promise<LeaderboardResultDto> {
    const { page, limit } = query;

    const offset = (page - 1) * limit;

    const { startAt, endAt } = getCurrentUtcWeekRange();

    const rows = await this.prisma.$queryRaw<
      LeaderboardSqlRow[]
    >(Prisma.sql`
      WITH weekly_exp AS (
        SELECT
          user_id,
          SUM(amount)::BIGINT AS weekly_exp

        FROM exp_transaction

        WHERE
          created_at >= ${startAt}
          AND created_at < ${endAt}

        GROUP BY user_id
      ),

      totals AS (
        SELECT COUNT(*)::BIGINT AS total_items
        FROM weekly_exp
      ),

      ranked AS (
        SELECT
          user_id,
          weekly_exp,

          RANK() OVER (
            ORDER BY weekly_exp DESC
          ) AS position

        FROM weekly_exp
      ),

      page_rows AS (
        SELECT
          user_id,
          weekly_exp,
          position

        FROM ranked

        ORDER BY
          weekly_exp DESC,
          user_id ASC

        LIMIT ${limit}
        OFFSET ${offset}
      )

      SELECT
        page_rows.user_id,
        page_rows.weekly_exp,
        page_rows.position,
        totals.total_items

      FROM totals

      LEFT JOIN page_rows ON TRUE

      ORDER BY
        page_rows.position NULLS LAST,
        page_rows.user_id;
    `);

    const totalItems = Number(
      rows[0]?.total_items ?? 0n,
    );

    const items = rows
      .filter(
        (row) => row.user_id !== null,
      )
      .map((row) => ({
        userId: row.user_id as string,

        position: Number(row.position),

        weeklyExp: String(row.weekly_exp ?? 0n),
      }));

    return {
      items,

      pagination: {
        page,
        limit,
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
      },
    };
  }
}