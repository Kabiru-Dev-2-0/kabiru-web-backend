import {
  Controller,
  Logger,
} from '@nestjs/common';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { env } from 'node:process';

import {
  AUTH_PATTERNS,
  USER_ROLES,
  createServiceError,
  type InternalRequest,
  type LoginRequest,
  type RefreshRequest,
  type RegisterRequest,
  type UserRole,
  type VerifyTokenRequest,
} from '@kabiru/contracts';

type StoredUser = {
  id: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  fullName: string;
  createdAt: string;
  updatedAt: string;
};

const USERS = new Map<string, StoredUser>();
const logger = new Logger('AuthService');

function getJwtSecret(): string {
  return process.env.JWT_ACCESS_SECRET ?? process.env.JWT_SECRET ?? 'dev-secret-change-me';
}
const ACCESS_EXPIRES_IN = '15m';
const REFRESH_EXPIRES_IN = '7d';

// Seed dev users (in-memory) untuk kemudahan development & pengujian berbagai role
const DEV_SEED_USERS: StoredUser[] = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    email: 'guru@kabiru.id',
    fullName: 'Guru Penguji',
    role: 'teacher',
    passwordHash: bcrypt.hashSync('password123', 10),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '00000000-0000-4000-8000-000000000002',
    email: 'admin@kabiru.id',
    fullName: 'Admin Kabiru',
    role: 'admin',
    passwordHash: bcrypt.hashSync('password123', 10),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '00000000-0000-4000-8000-000000000003',
    email: 'dev@kabiru.id',
    fullName: 'Developer Modul',
    role: 'developer',
    passwordHash: bcrypt.hashSync('password123', 10),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '00000000-0000-4000-8000-000000000004',
    email: 'siswa@kabiru.id',
    fullName: 'Siswa Uji Coba',
    role: 'student',
    passwordHash: bcrypt.hashSync('password123', 10),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

for (const seedUser of DEV_SEED_USERS) {
  USERS.set(seedUser.id, seedUser);
}

function sanitizeForLog(value: unknown) {
  if (typeof value !== 'string') return '[omitted]';
  return '[redacted]';
}

function unwrapPayload<T>(payload: unknown): Partial<T> {
  if (typeof payload === 'object' && payload !== null && 'data' in payload) {
    const inner = (payload as InternalRequest<T>).data;
    return (typeof inner === 'object' && inner !== null ? inner : {}) as Partial<T>;
  }
  return (typeof payload === 'object' && payload !== null ? payload : {}) as Partial<T>;
}

function buildTokenPair(user: StoredUser) {
  const secret = getJwtSecret();
  const accessToken = new JwtService({
    secret,
    signOptions: { expiresIn: ACCESS_EXPIRES_IN },
  }).sign({
    sub: user.id,
    userId: user.id,
    role: user.role,
    type: 'access',
  });

  const refreshToken = new JwtService({
    secret,
    signOptions: { expiresIn: REFRESH_EXPIRES_IN },
  }).sign({
    sub: user.id,
    userId: user.id,
    role: user.role,
    type: 'refresh',
  });

  return { accessToken, refreshToken, expiresIn: 15 * 60 };
}

@Controller()
export class AppController {
  @MessagePattern(AUTH_PATTERNS.REGISTER)
  register(@Payload() rawPayload: unknown) {
    const payload = unwrapPayload<RegisterRequest>(rawPayload);
    const email = payload.email?.trim().toLowerCase();
    const password = payload.password;
    const fullName = payload.fullName?.trim();

    if (!email || !password || !fullName) {
      throw new RpcException(
        createServiceError({
          code: 'VALIDATION_ERROR',
          httpStatus: 400,
          message: 'Data pendaftaran tidak valid.',
          details: [{ field: 'body', reason: 'email, password, dan fullName wajib diisi.' }],
        }),
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new RpcException(
        createServiceError({
          code: 'VALIDATION_ERROR',
          httpStatus: 400,
          message: 'Format email tidak valid.',
          details: [{ field: 'email', reason: 'format tidak valid' }],
        }),
      );
    }

    if (password.length < 8) {
      throw new RpcException(
        createServiceError({
          code: 'VALIDATION_ERROR',
          httpStatus: 400,
          message: 'Password terlalu pendek.',
          details: [{ field: 'password', reason: 'minimal 8 karakter' }],
        }),
      );
    }

    // Kebijakan Keamanan (OWASP A01: Broken Access Control):
    // Registrasi publik selalu diberikan role 'student'. Akun teacher/admin/developer
    // dikelola melalui seeding dev atau jalur administratif terproteksi.
    const userRole: UserRole = 'student';

    const existing = Array.from(USERS.values()).find((user) => user.email === email);
    if (existing) {
      throw new RpcException(
        createServiceError({
          code: 'AUTH_EMAIL_TAKEN',
          httpStatus: 409,
          message: 'Email sudah terdaftar.',
        }),
      );
    }

    const user: StoredUser = {
      id: randomUUID(),
      email,
      fullName,
      role: userRole,
      passwordHash: bcrypt.hashSync(password, 10),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    USERS.set(user.id, user);

    logger.debug(
      `register userId=${user.id} email=${sanitizeForLog(email)} role=${user.role}`,
    );

    const tokens = buildTokenPair(user);

    return {
      userId: user.id,
      role: user.role,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
    };
  }

  @MessagePattern(AUTH_PATTERNS.LOGIN)
  login(@Payload() rawPayload: unknown) {
    const payload = unwrapPayload<LoginRequest>(rawPayload);
    const email = payload.email?.trim().toLowerCase();
    const password = payload.password;

    if (!email || !password) {
      throw new RpcException(
        createServiceError({
          code: 'VALIDATION_ERROR',
          httpStatus: 400,
          message: 'Email dan password wajib diisi.',
        }),
      );
    }

    const user = Array.from(USERS.values()).find((item) => item.email === email);
    if (!user) {
      throw new RpcException(
        createServiceError({
          code: 'AUTH_INVALID_CREDENTIALS',
          httpStatus: 401,
          message: 'Email atau password tidak valid.',
        }),
      );
    }

    const match = bcrypt.compareSync(password, user.passwordHash);
    if (!match) {
      throw new RpcException(
        createServiceError({
          code: 'AUTH_INVALID_CREDENTIALS',
          httpStatus: 401,
          message: 'Email atau password tidak valid.',
        }),
      );
    }

    logger.debug(
      `login userId=${user.id} email=${sanitizeForLog(user.email)} role=${user.role}`,
    );

    const tokens = buildTokenPair(user);

    return {
      userId: user.id,
      role: user.role,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
    };
  }

  @MessagePattern(AUTH_PATTERNS.REFRESH)
  refresh(@Payload() rawPayload: unknown) {
    const payload = unwrapPayload<RefreshRequest>(rawPayload);
    if (!payload.refreshToken) {
      throw new RpcException(
        createServiceError({
          code: 'AUTH_INVALID_TOKEN',
          httpStatus: 401,
          message: 'Refresh token tidak valid.',
        }),
      );
    }

    try {
      const jwt = new JwtService({ secret: getJwtSecret() });
      const decoded = jwt.verify(payload.refreshToken) as {
        userId?: string;
        role?: UserRole;
        type?: string;
      };

      if (decoded.type !== 'refresh') {
        throw new RpcException(
          createServiceError({
            code: 'AUTH_INVALID_TOKEN',
            httpStatus: 401,
            message: 'Token tidak valid untuk refresh.',
          }),
        );
      }

      const user = USERS.get(decoded.userId ?? '');
      if (!user) {
        throw new RpcException(
          createServiceError({
            code: 'AUTH_INVALID_TOKEN',
            httpStatus: 401,
            message: 'User tidak ditemukan.',
          }),
        );
      }

      const tokens = buildTokenPair(user);

      logger.debug(`refresh userId=${user.id} role=${user.role}`);

      return {
        userId: user.id,
        role: user.role,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
      };
    } catch (error) {
      if (error instanceof RpcException) {
        throw error;
      }
      throw new RpcException(
        createServiceError({
          code: 'AUTH_INVALID_TOKEN',
          httpStatus: 401,
          message: 'Refresh token tidak valid atau kedaluwarsa.',
        }),
      );
    }
  }

  @MessagePattern(AUTH_PATTERNS.VERIFY)
  verify(@Payload() rawPayload: unknown) {
    const payload = unwrapPayload<VerifyTokenRequest>(rawPayload);
    if (!payload.accessToken) {
      throw new RpcException(
        createServiceError({
          code: 'AUTH_INVALID_TOKEN',
          httpStatus: 401,
          message: 'Token tidak ada.',
        }),
      );
    }

    try {
      const jwt = new JwtService({ secret: getJwtSecret() });
      const decoded = jwt.verify(payload.accessToken) as {
        userId?: string;
        role?: UserRole;
        type?: string;
      };

      if (decoded.type !== 'access') {
        throw new RpcException(
          createServiceError({
            code: 'AUTH_INVALID_TOKEN',
            httpStatus: 401,
            message: 'Token tidak valid.',
          }),
        );
      }

      return {
        valid: true,
        userId: decoded.userId ?? '',
        role: decoded.role ?? 'student',
      };
    } catch (error) {
      if (error instanceof RpcException) {
        throw error;
      }
      throw new RpcException(
        createServiceError({
          code: 'AUTH_INVALID_TOKEN',
          httpStatus: 401,
          message: 'Token tidak valid atau kedaluwarsa.',
        }),
      );
    }
  }
}