export interface UpdateChallengeProgressDto {
  userId: string;
  challengeId: string;
  periodStart: string | Date;
  incrementValue?: number;
  setValue?: number;
}

export interface GetChallengeProgressDto {
  userId: string;
  challengeId: string;
  periodStart: string | Date;
}
