import { z } from 'zod';

export const leaderboardQuerySchema = z.object({
  page: z.preprocess(
    (value) =>
      value === '' || value === undefined || value === null
        ? 1
        : value,
    z.coerce.number().int().min(1),
  ),

  limit: z.preprocess(
    (value) =>
      value === '' || value === undefined || value === null
        ? 20
        : value,
    z.coerce.number().int().min(1).max(100),
  ),
});

export type LeaderboardQueryInput =
  z.infer<typeof leaderboardQuerySchema>;