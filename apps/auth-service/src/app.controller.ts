import {
  BadRequestException,
  Controller,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { env } from 'node:process';

import {
  AUTH_PATTERNS,
  RegisterRequest,
  LoginRequest,
  RefreshRequest,
  UserRole,
  VerifyTokenRequest,
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

const JWT_SECRET = env.JWT_SECRET ?? 'dev-secret-change-me';
const ACCESS_EXPIRES_IN = '15m';
const REFRESH_EXPIRES_IN = '7d';

function sanitizeForLog(value: unknown) {
  if (typeof value !== 'string') return '[omitted]';
  return '[redacted]';
}

function buildTokenPair(user: StoredUser) {
  const accessToken = new JwtService({
    secret: JWT_SECRET,
    signOptions: { expiresIn: ACCESS_EXPIRES_IN },
  }).sign({
    sub: user.id,
    userId: user.id,
    role: user.role,
    type: 'access',
  });

  const refreshToken = new JwtService({
    secret: JWT_SECRET,
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
  register(@Payload() payload: RegisterRequest) {
    const email = payload.email?.trim().toLowerCase();
    const password = payload.password;
    const fullName = payload.fullName?.trim();

    if (!email || !password || !fullName) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Data pendaftaran tidak valid.',
        details: [{ field: 'body', reason: 'email, password, dan fullName wajib diisi.' }],
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Format email tidak valid.',
        details: [{ field: 'email', reason: 'format tidak valid' }],
      });
    }

    if (password.length < 8) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Password terlalu pendek.',
        details: [{ field: 'password', reason: 'minimal 8 karakter' }],
      });
    }

    const existing = Array.from(USERS.values()).find((user) => user.email === email);
    if (existing) {
      throw new BadRequestException({
        code: 'AUTH_EMAIL_TAKEN',
        message: 'Email sudah terdaftar.',
      });
    }

    const user: StoredUser = {
      id: randomUUID(),
      email,
      fullName,
      role: payload.role ?? 'student',
      passwordHash: bcrypt.hashSync(password, 10),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    USERS.set(user.id, user);

    logger.debug(
      `register userId=${user.id} email=${sanitizeForLog(email)} role=${user.role}`,
    );

    return {
      userId: user.id,
      role: user.role,
      accessToken: buildTokenPair(user).accessToken,
      refreshToken: buildTokenPair(user).refreshToken,
      expiresIn: 15 * 60,
    };
  }

  @MessagePattern(AUTH_PATTERNS.LOGIN)
  login(@Payload() payload: LoginRequest) {
    const email = payload.email?.trim().toLowerCase();
    const password = payload.password;

    if (!email || !password) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Email dan password wajib diisi.',
      });
    }

    const user = Array.from(USERS.values()).find((item) => item.email === email);
    if (!user) {
      throw new UnauthorizedException({
        code: 'AUTH_INVALID_CREDENTIALS',
        message: 'Email atau password tidak valid.',
      });
    }

    const match = bcrypt.compareSync(password, user.passwordHash);
    if (!match) {
      throw new UnauthorizedException({
        code: 'AUTH_INVALID_CREDENTIALS',
        message: 'Email atau password tidak valid.',
      });
    }

    logger.debug(
      `login userId=${user.id} email=${sanitizeForLog(user.email)} role=${user.role}`,
    );

    return {
      userId: user.id,
      role: user.role,
      accessToken: buildTokenPair(user).accessToken,
      refreshToken: buildTokenPair(user).refreshToken,
      expiresIn: 15 * 60,
    };
  }

  @MessagePattern(AUTH_PATTERNS.REFRESH)
  refresh(@Payload() payload: RefreshRequest) {
    if (!payload.refreshToken) {
      throw new UnauthorizedException({
        code: 'AUTH_INVALID_TOKEN',
        message: 'Refresh token tidak valid.',
      });
    }

    try {
      const jwt = new JwtService({ secret: JWT_SECRET });
      const decoded = jwt.verify(payload.refreshToken) as {
        userId?: string;
        role?: UserRole;
        type?: string;
      };

      if (decoded.type !== 'refresh') {
        throw new UnauthorizedException({
          code: 'AUTH_INVALID_TOKEN',
          message: 'Token tidak valid untuk refresh.',
        });
      }

      const user = USERS.get(decoded.userId ?? '');
      if (!user) {
        throw new UnauthorizedException({
          code: 'AUTH_INVALID_TOKEN',
          message: 'User tidak ditemukan.',
        });
      }

      const tokens = buildTokenPair(user);

      logger.debug(`refresh userId=${user.id} role=${user.role}`);

      return {
        userId: user.id,
        role: user.role,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: 15 * 60,
      };
    } catch (error) {
      throw new UnauthorizedException({
        code: 'AUTH_INVALID_TOKEN',
        message: 'Refresh token tidak valid atau kedaluwarsa.',
      });
    }
  }

  @MessagePattern(AUTH_PATTERNS.VERIFY)
  verify(@Payload() payload: VerifyTokenRequest) {
    if (!payload.accessToken) {
      throw new UnauthorizedException({
        code: 'AUTH_INVALID_TOKEN',
        message: 'Token tidak ada.',
      });
    }

    try {
      const jwt = new JwtService({ secret: JWT_SECRET });
      const decoded = jwt.verify(payload.accessToken) as {
        userId?: string;
        role?: UserRole;
        type?: string;
      };

      if (decoded.type !== 'access') {
        throw new UnauthorizedException({
          code: 'AUTH_INVALID_TOKEN',
          message: 'Token tidak valid.',
        });
      }

      return {
        valid: true,
        userId: decoded.userId ?? '',
        role: decoded.role ?? 'student',
      };
    } catch (error) {
      throw new UnauthorizedException({
        code: 'AUTH_INVALID_TOKEN',
        message: 'Token tidak valid atau kedaluwarsa.',
      });
    }
  }
}