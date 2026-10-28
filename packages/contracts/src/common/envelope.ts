export const USER_ROLES = ['student', 'teacher', 'admin', 'developer'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const AUTHORING_ROLES: readonly UserRole[] = ['teacher', 'admin', 'developer'];

export const EDUCATION_LEVEL_CODES = ['SD', 'SMP', 'SMA'] as const;
export type EducationLevelCode = (typeof EDUCATION_LEVEL_CODES)[number];

export type CallerService =
  | 'api-gateway'
  | 'auth-service'
  | 'user-service'
  | 'learning-service'
  | 'progress-service'
  | 'ai-service';

export interface ActorContext {
  userId: string;
  role: UserRole;
  educationLevelCode?: EducationLevelCode | null;
}

export interface InternalRequestMeta {
  requestId: string;
  actor: ActorContext | null;
  callerService?: CallerService;
}

export interface InternalRequest<TData = Record<string, never>> {
  meta: InternalRequestMeta;
  data: TData;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

export interface ApiSuccessResponse<TData> {
  data: TData;
  meta: {
    requestId: string;
    pagination?: PaginationMeta;
  };
}