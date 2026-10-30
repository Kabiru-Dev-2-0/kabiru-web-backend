import {
  BadRequestException,
  Controller,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

import {
  AUTH_PATTERNS,
  USER_ROLES,
  UserRole,
} from '@kabiru/contracts';

type UserProfile = {
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
};

const USERS = new Map<string, UserProfile>();
const logger = new Logger('UserService');

@Controller()
export class AppController {
  @MessagePattern('user.profile.create')
  createProfile(
    @Payload()
    payload: {
      userId: string;
      fullName: string;
      role: UserRole;
    },
  ) {
    const userId = payload?.userId?.trim();
    const fullName = payload?.fullName?.trim();
    if (!userId || !fullName || !USER_ROLES.includes(payload.role)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Data profil tidak valid.',
      });
    }

    const existing = USERS.get(userId);
    if (existing) return existing;

    const now = new Date().toISOString();
    const profile: UserProfile = {
      id: userId,
      userId,
      fullName,
      role: payload.role,
      createdAt: now,
      updatedAt: now,
    };

    USERS.set(userId, profile);
    return profile;
  }

  @MessagePattern('user.profile.get')
  getProfile(@Payload() payload: { userId: string }) {
    const userId = payload?.userId;
    if (!userId) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'userId wajib diisi.',
      });
    }

    const profile = USERS.get(userId);
    if (!profile) {
      throw new NotFoundException({
        code: 'USER_PROFILE_NOT_FOUND',
        message: 'Profil tidak ditemukan.',
      });
    }

    return profile;
  }

  @MessagePattern('user.profile.update')
  updateProfile(
    @Payload()
    payload: {
      userId: string;
      fullName?: string;
      phone?: string | null;
      avatarUrl?: string | null;
      schoolName?: string | null;
      educationLevel?: string | null;
      role?: UserRole;
    },
  ) {
    const userId = payload?.userId;
    if (!userId) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'userId wajib diisi.',
      });
    }

    const profile = USERS.get(userId);
    if (!profile) {
      throw new NotFoundException({
        code: 'USER_PROFILE_NOT_FOUND',
        message: 'Profil tidak ditemukan.',
      });
    }

    if (payload.role && !USER_ROLES.includes(payload.role)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Role tidak valid.',
      });
    }

    const updated: UserProfile = {
      ...profile,
      fullName: payload.fullName?.trim() || profile.fullName,
      phone: payload.phone ?? profile.phone,
      avatarUrl: payload.avatarUrl ?? profile.avatarUrl,
      schoolName: payload.schoolName ?? profile.schoolName,
      educationLevel: payload.educationLevel ?? profile.educationLevel,
      role: payload.role ?? profile.role,
      updatedAt: new Date().toISOString(),
    };

    USERS.set(userId, updated);

    logger.debug(`updateProfile userId=${userId} role=${updated.role}`);

    return updated;
  }
}