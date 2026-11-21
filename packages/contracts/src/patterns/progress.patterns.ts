export const PROGRESS_PATTERNS = {
  LEADERBOARD_GET: 'progress.leaderboard.get',
} as const;

export type ProgressPattern =
  (typeof PROGRESS_PATTERNS)[keyof typeof PROGRESS_PATTERNS];