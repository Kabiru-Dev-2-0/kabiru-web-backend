export const USER_PATTERNS = {
  PROFILE_CREATE: 'user.profile.create',
  PROFILE_GET: 'user.profile.get',
  PROFILE_UPDATE: 'user.profile.update',
  PROFILE_LIST: 'user.profile.list',
} as const;

export type UserPattern = (typeof USER_PATTERNS)[keyof typeof USER_PATTERNS];
