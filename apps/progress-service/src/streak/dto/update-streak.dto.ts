export interface UpdateStreakDto {
  userId: string;
  activityDate?: string | Date;
}

export interface AddStreakFreezeDto {
  userId: string;
  count: number;
}

export interface SetDailyTargetDto {
  userId: string;
  dailyTarget: number;
}
