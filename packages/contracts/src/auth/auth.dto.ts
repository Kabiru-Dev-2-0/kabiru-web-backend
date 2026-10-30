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