import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeToUtcDate } from '../common/date.util';
import { createRpcError } from '../common/rpc-exception.util';
import {
  GetActivityQueryDto,
  GetActivityRangeQueryDto,
  RecordActivityDto,
} from './dto/record-activity.dto';

@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);

  constructor(private readonly prisma: PrismaService) {}

  async recordActivity(dto: RecordActivityDto) {
    if (!dto.userId) {
      throw createRpcError({
        code: 'VALIDATION_ERROR',
        httpStatus: 400,
        message: 'userId wajib diisi',
      });
    }

    const activityDate = normalizeToUtcDate(dto.activityDate);

    return this.prisma.dailyActivity.upsert({
      where: {
        userId_activityDate: {
          userId: dto.userId,
          activityDate,
        },
      },
      update: {
        expEarned: {
          increment: dto.expEarned ?? 0,
        },
        testsDone: {
          increment: dto.testsDone ?? 0,
        },
        ...(dto.loggedIn !== undefined ? { loggedIn: dto.loggedIn } : {}),
        ...(dto.freezeUsed !== undefined ? { freezeUsed: dto.freezeUsed } : {}),
      },
      create: {
        userId: dto.userId,
        activityDate,
        expEarned: dto.expEarned ?? 0,
        testsDone: dto.testsDone ?? 0,
        loggedIn: dto.loggedIn ?? true,
        freezeUsed: dto.freezeUsed ?? false,
      },
    });
  }

  async getActivity(query: GetActivityQueryDto) {
    if (!query.userId) {
      throw createRpcError({
        code: 'VALIDATION_ERROR',
        httpStatus: 400,
        message: 'userId wajib diisi',
      });
    }

    const activityDate = normalizeToUtcDate(query.activityDate);

    const record = await this.prisma.dailyActivity.findUnique({
      where: {
        userId_activityDate: {
          userId: query.userId,
          activityDate,
        },
      },
    });

    if (!record) {
      return {
        userId: query.userId,
        activityDate,
        expEarned: 0,
        testsDone: 0,
        loggedIn: false,
        freezeUsed: false,
      };
    }

    return record;
  }

  async getActivitiesRange(query: GetActivityRangeQueryDto) {
    if (!query.userId || !query.startDate || !query.endDate) {
      throw createRpcError({
        code: 'VALIDATION_ERROR',
        httpStatus: 400,
        message: 'userId, startDate, dan endDate wajib diisi',
      });
    }

    const startDate = normalizeToUtcDate(query.startDate);
    const endDate = normalizeToUtcDate(query.endDate);

    return this.prisma.dailyActivity.findMany({
      where: {
        userId: query.userId,
        activityDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: {
        activityDate: 'asc',
      },
    });
  }
}
