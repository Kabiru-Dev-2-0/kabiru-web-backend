import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';
import {
  USER_PATTERNS,
  USER_ROLES,
  createServiceError,
  type InternalRequest,
  type ListUsersQueryDto,
  type UserRole,
} from '@kabiru/contracts';

export type UserProfile = {
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

// Seed dev profiles (in-memory) yang selaras dengan dev users di auth-service
const DEV_SEED_PROFILES: UserProfile[] = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    userId: '00000000-0000-4000-8000-000000000001',
    fullName: 'Guru Penguji',
    schoolName: 'SMA Negeri 1 Kabiru',
    educationLevel: 'SMA',
    role: 'teacher',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '00000000-0000-4000-8000-000000000002',
    userId: '00000000-0000-4000-8000-000000000002',
    fullName: 'Admin Kabiru',
    schoolName: 'LMS Pusat',
    educationLevel: 'SMA',
    role: 'admin',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '00000000-0000-4000-8000-000000000003',
    userId: '00000000-0000-4000-8000-000000000003',
    fullName: 'Developer Modul',
    schoolName: 'Lab Game Kabiru',
    educationLevel: 'SMA',
    role: 'developer',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '00000000-0000-4000-8000-000000000004',
    userId: '00000000-0000-4000-8000-000000000004',
    fullName: 'Siswa Uji Coba',
    schoolName: 'SMA Negeri 1 Kabiru',
    educationLevel: 'SMA',
    role: 'student',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

for (const profile of DEV_SEED_PROFILES) {
  USERS.set(profile.userId, profile);
}

function unwrapPayload<T>(payload: unknown): Partial<T> {
  if (typeof payload === 'object' && payload !== null && 'data' in payload) {
    const inner = (payload as InternalRequest<T>).data;
    return (typeof inner === 'object' && inner !== null ? inner : {}) as Partial<T>;
  }
  return (typeof payload === 'object' && payload !== null ? payload : {}) as Partial<T>;
}

@Controller()
export class AppController {
  @MessagePattern('user.profile.create')
  createProfile(@Payload() rawPayload: unknown) {
    const payload = unwrapPayload<{
      userId: string;
      fullName: string;
      role: UserRole;
      phone?: string | null;
      avatarUrl?: string | null;
      schoolName?: string | null;
      educationLevel?: string | null;
    }>(rawPayload);

    const userId = payload?.userId?.trim();
    const fullName = payload?.fullName?.trim();
    const role = payload?.role;

    if (!userId || !fullName || !role || !USER_ROLES.includes(role)) {
      throw new RpcException(
        createServiceError({
          code: 'VALIDATION_ERROR',
          httpStatus: 400,
          message: 'Data profil tidak valid. userId, fullName, dan role wajib diisi.',
        }),
      );
    }

    const existing = USERS.get(userId);
    if (existing) return existing;

    const now = new Date().toISOString();
    const profile: UserProfile = {
      id: userId,
      userId,
      fullName,
      phone: payload.phone ?? null,
      avatarUrl: payload.avatarUrl ?? null,
      schoolName: payload.schoolName ?? null,
      educationLevel: payload.educationLevel ?? null,
      role,
      createdAt: now,
      updatedAt: now,
    };

    USERS.set(userId, profile);
    logger.debug(`createProfile userId=${userId} role=${profile.role}`);
    return profile;
  }

  @MessagePattern('user.profile.get')
  getProfile(@Payload() rawPayload: unknown) {
    const payload = unwrapPayload<{ userId: string }>(rawPayload);
    const userId = payload?.userId?.trim();

    if (!userId) {
      throw new RpcException(
        createServiceError({
          code: 'VALIDATION_ERROR',
          httpStatus: 400,
          message: 'userId wajib diisi.',
        }),
      );
    }

    const profile = USERS.get(userId);
    if (!profile) {
      throw new RpcException(
        createServiceError({
          code: 'USER_PROFILE_NOT_FOUND',
          httpStatus: 404,
          message: 'Profil user tidak ditemukan.',
        }),
      );
    }

    return profile;
  }

  @MessagePattern('user.profile.update')
  updateProfile(@Payload() rawPayload: unknown) {
    const payload = unwrapPayload<{
      userId: string;
      fullName?: string;
      phone?: string | null;
      avatarUrl?: string | null;
      schoolName?: string | null;
      educationLevel?: string | null;
      role?: UserRole;
    }>(rawPayload);

    const userId = payload?.userId?.trim();
    if (!userId) {
      throw new RpcException(
        createServiceError({
          code: 'VALIDATION_ERROR',
          httpStatus: 400,
          message: 'userId wajib diisi.',
        }),
      );
    }

    const profile = USERS.get(userId);
    if (!profile) {
      throw new RpcException(
        createServiceError({
          code: 'USER_PROFILE_NOT_FOUND',
          httpStatus: 404,
          message: 'Profil user tidak ditemukan.',
        }),
      );
    }

    if (payload.role && !USER_ROLES.includes(payload.role)) {
      throw new RpcException(
        createServiceError({
          code: 'VALIDATION_ERROR',
          httpStatus: 400,
          message: 'Role tidak valid.',
        }),
      );
    }

    const updated: UserProfile = {
      ...profile,
      fullName: payload.fullName?.trim() || profile.fullName,
      phone: payload.phone !== undefined ? payload.phone : profile.phone,
      avatarUrl: payload.avatarUrl !== undefined ? payload.avatarUrl : profile.avatarUrl,
      schoolName: payload.schoolName !== undefined ? payload.schoolName : profile.schoolName,
      educationLevel: payload.educationLevel !== undefined ? payload.educationLevel : profile.educationLevel,
      role: payload.role ?? profile.role,
      updatedAt: new Date().toISOString(),
    };

    USERS.set(userId, updated);
    logger.debug(`updateProfile userId=${userId} role=${updated.role}`);
    return updated;
  }

  @MessagePattern(USER_PATTERNS.PROFILE_LIST)
  @MessagePattern('user.profile.list')
  listProfiles(@Payload() rawPayload: unknown) {
    const payload = unwrapPayload<ListUsersQueryDto>(rawPayload);
    const filterRole = payload.role;
    const filterSearch = payload.search?.trim().toLowerCase();
    const filterUserIds = payload.userIds;

    let list = Array.from(USERS.values());

    if (filterUserIds?.length) {
      const userIdSet = new Set(filterUserIds);
      list = list.filter((p) => userIdSet.has(p.userId));
    }

    if (filterRole && USER_ROLES.includes(filterRole)) {
      list = list.filter((p) => p.role === filterRole);
    }

    if (filterSearch) {
      list = list.filter(
        (p) =>
          p.fullName.toLowerCase().includes(filterSearch) ||
          (p.schoolName && p.schoolName.toLowerCase().includes(filterSearch)),
      );
    }

    return list;
  }
}
