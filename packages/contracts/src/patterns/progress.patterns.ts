export const PROGRESS_PATTERNS = {
  LEADERBOARD_GET: 'progress.leaderboard.get',
  SUBMISSION_CREATE: 'progress.submission.create',
} as const;

export type ProgressPattern =
  (typeof PROGRESS_PATTERNS)[keyof typeof PROGRESS_PATTERNS];