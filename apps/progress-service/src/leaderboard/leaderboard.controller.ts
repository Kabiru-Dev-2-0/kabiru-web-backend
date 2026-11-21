import {
  Controller,
} from '@nestjs/common';

import {
  MessagePattern,
  Payload,
  RpcException,
} from '@nestjs/microservices';

import {
  PROGRESS_PATTERNS,
  leaderboardQuerySchema,
  createServiceError,
  type InternalRequest,
} from '@kabiru/contracts';

import { LeaderboardService } from './leaderboard.service';

@Controller()
export class LeaderboardController {
  constructor(
    private readonly leaderboardService: LeaderboardService,
  ) {}

  @MessagePattern(PROGRESS_PATTERNS.LEADERBOARD_GET)
  async getLeaderboard(
    @Payload() rawPayload: unknown,
  ) {
    const request =
      rawPayload as Partial<InternalRequest<unknown>>;

    const actor = request?.meta?.actor;

    // Autentikasi wajib.
    if (!actor?.userId) {
      throw new RpcException(
        createServiceError({
          code: 'UNAUTHENTICATED',
          httpStatus: 401,
          message: 'Autentikasi diperlukan.',
        }),
      );
    }

    const parsed = leaderboardQuerySchema.safeParse(
      request.data ?? {},
    );

    // Validasi pagination.
    if (!parsed.success) {
      throw new RpcException(
        createServiceError({
          code: 'VALIDATION_ERROR',
          httpStatus: 400,
          message: 'Parameter leaderboard tidak valid.',

          details: parsed.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            reason: issue.message,
          })),
        }),
      );
    }

    return this.leaderboardService.getWeeklyLeaderboard(
      parsed.data,
    );
  }
}