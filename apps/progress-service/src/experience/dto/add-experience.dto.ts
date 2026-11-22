import { ExpSource, MasteryLevel } from '.prisma/progress-client';

export interface AddExperienceDto {
  userId: string;
  amount: number;
  sourceType: ExpSource;
  sourceId: string;
}

export interface GetExpHistoryDto {
  userId: string;
  limit?: number;
}

export interface CreateMasteryRuleDto {
  mastery: MasteryLevel;
  baseExp: number;
  expBonus: number;
  rankPoint: number;
}
