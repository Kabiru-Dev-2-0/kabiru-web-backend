import {
  Body,
  Controller,
  Get,
  Headers,
  HttpException,
  HttpStatus,
  Patch,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ClientTCP } from '@nestjs/microservices';
import { randomUUID } from 'node:crypto';
import { env } from 'node:process';
import { firstValueFrom } from 'rxjs';

function getRequestId(headers: Record<string, string | undefined>) {
  return headers['x-request-id'] ?? randomUUID();
}

function extractBearerToken(headers: Record<string, string | undefined>) {
  const auth = headers.authorization ?? headers.Authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    throw new UnauthorizedException({
      code: 'UNAUTHENTICATED',
      message: 'Token tidak ada atau tidak valid.',
    });
  }
  return auth.replace('Bearer ', '').trim();
}

function requireRole(role: string | string[], actorRole?: string) {
  const allowed = Array.isArray(role) ? role : [role];
  if (!actorRole || !allowed.includes(actorRole)) {
    throw new HttpException(
      {
        error: {
          code: 'FORBIDDEN',
          message: 'Role tidak diizinkan melakukan operasi ini.',
        },
        meta: { requestId: randomUUID() },
      },
      HttpStatus.FORBIDDEN,
    );
  }
}

@Controller()
export class AppController {
  private readonly authClient: ClientTCP;
  private readonly userClient: ClientTCP;

  constructor() {
    this.authClient = new ClientTCP({
      host: env.AUTH_SERVICE_HOST ?? 'localhost',
      port: Number(env.AUTH_SERVICE_PORT ?? 4011),
    });

    this.userClient = new ClientTCP({
      host: env.USER_SERVICE_HOST ?? 'localhost',
      port: Number(env.USER_SERVICE_PORT ?? 4012),
    });
  }

  @Post('auth/register')
  async register(@Body() body: any, @Headers() headers: Record<string, string | undefined>) {
    const requestId = getRequestId(headers);

    const result = await firstValueFrom(
      this.authClient.send('auth.register', body),
    );

    await firstValueFrom(
      this.userClient.send('user.profile.create', {
        userId: result.userId,
        fullName: body.fullName,
        role: result.role,
      }),
    );

    return { data: result, meta: { requestId } };
  }

  @Post('auth/login')
  async login(@Body() body: any, @Headers() headers: Record<string, string | undefined>) {
    const requestId = getRequestId(headers);

    const result = await firstValueFrom(
      this.authClient.send('auth.login', body),
    );

    return { data: result, meta: { requestId } };
  }

  @Post('auth/refresh')
  async refresh(@Body() body: any, @Headers() headers: Record<string, string | undefined>) {
    const requestId = getRequestId(headers);

    const result = await firstValueFrom(
      this.authClient.send('auth.refresh', body),
    );

    return { data: result, meta: { requestId } };
  }

  @Get('users/me')
  async me(@Headers() headers: Record<string, string | undefined>) {
    const requestId = getRequestId(headers);
    const token = extractBearerToken(headers);
    const { userId, role } = await firstValueFrom(
      this.authClient.send('auth.verify', { accessToken: token }),
    );

    const profile = await firstValueFrom(
      this.userClient.send('user.profile.get', { userId }),
    );

    return { data: profile, meta: { requestId } };
  }

  @Patch('users/me/profile')
  async updateProfile(@Body() body: any, @Headers() headers: Record<string, string | undefined>) {
    const requestId = getRequestId(headers);
    const token = extractBearerToken(headers);

    const verified = await firstValueFrom(
      this.authClient.send('auth.verify', { accessToken: token }),
    );

    requireRole(['student', 'teacher', 'admin', 'developer'], verified.role);

    const profile = await firstValueFrom(
      this.userClient.send('user.profile.update', {
        userId: verified.userId,
        fullName: body.fullName,
        phone: body.phone,
        avatarUrl: body.avatarUrl,
        schoolName: body.schoolName,
        educationLevel: body.educationLevel,
      }),
    );

    return { data: profile, meta: { requestId } };
  }
}