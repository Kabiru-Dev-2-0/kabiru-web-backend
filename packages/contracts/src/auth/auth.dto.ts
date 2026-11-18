import type { UserRole } from '../common/envelope';

export interface RegisterRequest {
    email: string;
    password: string;
    fullName: string;
    role?: UserRole;
}

export interface LoginRequest {
    email: string;
    password: string;
}

export interface RefreshRequest {
    refreshToken: string;
}

export interface AuthTokenPayload {
    sub: string;
    userId: string;
    role: UserRole;
    type: 'access' | 'refresh';
}

export interface AuthSuccessResponse {
    userId: string;
    role: UserRole;
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
}

export interface VerifyTokenRequest {
    accessToken: string;
}

export interface VerifyTokenResponse {
    valid: true;
    userId: string;
    role: UserRole;
}

export interface UserProfileResponse {
    id: string;
    userId: string;
    fullName: string;
    phone?: string | null;
    avatarUrl?: string | null;
    schoolName?: string | null;
    educationLevel?: string | null;
    role: UserRole;
    createdAt: string;
    updatedAt: string;
}

export interface UpdateUserRoleRequest {
    userId: string;
    role: UserRole;
}

export interface AdminCreateUserRequest {
    email: string;
    password: string;
    fullName: string;
    role: UserRole;
    phone?: string | null;
    avatarUrl?: string | null;
    schoolName?: string | null;
    educationLevel?: string | null;
}

export interface UserSummaryItemDto {
    id: string;
    userId: string;
    email: string;
    fullName: string;
    role: UserRole;
    phone?: string | null;
    avatarUrl?: string | null;
    schoolName?: string | null;
    educationLevel?: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface ListUsersQueryDto {
    role?: UserRole;
    search?: string;
}