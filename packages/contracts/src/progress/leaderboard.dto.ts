import type { PaginationMeta } from '../common/envelope';

export interface LeaderboardQueryDto {
  page: number;
  limit: number;
}

export interface LeaderboardEntryDto {
  userId: string;
  position: number;
  weeklyExp: string;
  fullName?: string | null;
  avatarUrl?: string | null;
}

export interface LeaderboardResultDto {
  items: LeaderboardEntryDto[];
  pagination: PaginationMeta;
}