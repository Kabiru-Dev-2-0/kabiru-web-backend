export interface RecordActivityDto {
  userId: string;
  activityDate?: string | Date;
  expEarned?: number;
  testsDone?: number;
  loggedIn?: boolean;
  freezeUsed?: boolean;
}

export interface GetActivityQueryDto {
  userId: string;
  activityDate?: string | Date;
}

export interface GetActivityRangeQueryDto {
  userId: string;
  startDate: string | Date;
  endDate: string | Date;
}
