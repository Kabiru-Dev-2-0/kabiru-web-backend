export const AUTH_PATTERNS = {
  REGISTER: 'auth.register',
  LOGIN: 'auth.login',
  REFRESH: 'auth.refresh',
  VERIFY: 'auth.verify',
  UPDATE_ROLE: 'auth.user.updateRole',
  LIST_USERS: 'auth.user.list',
  ADMIN_CREATE_USER: 'auth.admin.createUser',
} as const;

export type AuthPattern = (typeof AUTH_PATTERNS)[keyof typeof AUTH_PATTERNS];
