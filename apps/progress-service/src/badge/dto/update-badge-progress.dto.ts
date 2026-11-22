export interface UpdateBadgeProgressDto {
  userId: string;
  badgeId: string;
  incrementValue?: number;
  setValue?: number;
  targetValue?: number;
}

export interface AwardBadgeDto {
  userId: string;
  badgeId: string;
}
