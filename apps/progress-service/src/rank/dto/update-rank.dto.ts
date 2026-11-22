export interface UpdateRankDto {
  userId: string;
  menu: string;
  averagePoint: number;
}

export interface CreateRankTierDto {
  name: string;
  minAveragePoint: number;
  maxAveragePoint: number;
}
