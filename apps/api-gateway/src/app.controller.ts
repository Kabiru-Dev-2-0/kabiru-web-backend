import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpException,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { randomUUID } from 'node:crypto';
import { firstValueFrom, timeout as rxTimeout, TimeoutError } from 'rxjs';
import {
  AUTH_PATTERNS,
  type ActorContext,
  type ApiErrorResponse,
  type ApiSuccessResponse,
  GAME_PATTERNS,
  type InternalRequest,
  type UserRole,
} from '@kabiru/contracts';

type GatewayHeaders = Record<string, string | undefined>;

const RPC_TIMEOUTS = {
  auth: 3000,
  user: 3000,
  learningRead: 4000,
  learningWrite: 8000,
  progressRead: 4000,
  progressTransaction: 8000,
  aiHint: 20000,
  aiAgent: 25000,
} as const;

function normalizeRequestId(input?: string) {
  return input && /^[0-9a-fA-F-]{36}$/.test(input) ? input : randomUUID();
}

function getRequestId(headers: GatewayHeaders) {
  return normalizeRequestId(headers['x-request-id'] ?? headers['X-Request-Id']);
}

function extractBearerToken(headers: GatewayHeaders): string {
  const auth = headers.authorization ?? headers.Authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    throw new UnauthorizedException({
      error: {
        code: 'UNAUTHENTICATED',
        message: 'Token tidak ada atau tidak valid.',
      },
      meta: { requestId: getRequestId(headers) },
    });
  }
  return auth.replace(/^Bearer\s+/i, '').trim();
}

function normalizeErrorResponse(error: any, requestId: string): never {
  const payload = error?.response ?? error?.error ?? error;

  if (
    payload &&
    typeof payload === 'object' &&
    'code' in payload &&
    'message' in payload
  ) {
    const httpStatus = Number((payload as any).httpStatus ?? HttpStatus.INTERNAL_SERVER_ERROR);

    throw new HttpException(
      {
        error: {
          code: (payload as any).code ?? 'INTERNAL_ERROR',
          message: (payload as any).message ?? 'Request gagal.',
          details: (payload as any).details ?? undefined,
        },
        meta: { requestId },
      },
      Number.isFinite(httpStatus) ? httpStatus : HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  if (error instanceof TimeoutError) {
    throw new HttpException(
      {
        error: {
          code: 'UPSTREAM_TIMEOUT',
          message: 'Service tujuan tidak merespons dalam waktu yang ditentukan.',
        },
        meta: { requestId },
      },
      HttpStatus.GATEWAY_TIMEOUT,
    );
  }

  throw new HttpException(
    {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Terjadi kesalahan internal pada gateway.',
      },
      meta: { requestId },
    },
    HttpStatus.INTERNAL_SERVER_ERROR,
  );
}

async function verifyActor(
  authClient: ClientProxy,
  headers: GatewayHeaders,
): Promise<ActorContext> {
  const requestId = getRequestId(headers);
  const token = extractBearerToken(headers);

  try {
    const verified = await firstValueFrom(
      authClient.send(AUTH_PATTERNS.VERIFY, { accessToken: token }).pipe(rxTimeout(RPC_TIMEOUTS.auth)),
    );

    if (!verified?.valid) {
      throw new UnauthorizedException({
        error: { code: 'UNAUTHENTICATED', message: 'Token tidak valid atau kedaluwarsa.' },
        meta: { requestId },
      });
    }

    return {
      userId: verified.userId,
      role: verified.role as UserRole,
    };
  } catch (error) {
    normalizeErrorResponse(error, requestId);
  }
}

async function sendTo<T>(
  client: ClientProxy,
  pattern: string,
  data: unknown,
  meta: InternalRequest['meta'],
  timeoutMs: number,
): Promise<T> {
  try {
    return await firstValueFrom(
      client.send(pattern, { meta, data }).pipe(rxTimeout(timeoutMs)),
    );
  } catch (error) {
    normalizeErrorResponse(error, meta.requestId);
  }
}

@Controller()
export class AppController {
  constructor(
    @Inject('AUTH_CLIENT') private readonly authClient: ClientProxy,
    @Inject('USER_CLIENT') private readonly userClient: ClientProxy,
    @Inject('LEARNING_CLIENT') private readonly learningClient: ClientProxy,
    @Inject('PROGRESS_CLIENT') private readonly progressClient: ClientProxy,
    @Inject('AI_CLIENT') private readonly aiClient: ClientProxy,
  ) {}

  private buildMeta(headers: GatewayHeaders, actor: ActorContext | null = null) {
    return {
      requestId: getRequestId(headers),
      actor,
      callerService: 'api-gateway' as const,
    };
  }

  private async gameModuleForward<T>(
    headers: GatewayHeaders,
    pattern: string,
    data: unknown,
    allowAnonymous = false,
    timeoutMs: number = RPC_TIMEOUTS.learningRead,
  ): Promise<ApiSuccessResponse<T>> {
    const requestId = getRequestId(headers);
    const actor = allowAnonymous
      ? await verifyActor(this.authClient, headers).catch(() => null)
      : await verifyActor(this.authClient, headers);
    const result = await sendTo<T>(
      this.learningClient,
      pattern,
      data,
      this.buildMeta(headers, actor),
      timeoutMs,
    );

    return { data: result, meta: { requestId } };
  }

  @Post('auth/register')
  async register(
    @Body() body: any,
    @Headers() headers: GatewayHeaders,
  ): Promise<ApiSuccessResponse<any>> {
    const requestId = getRequestId(headers);
    const meta = this.buildMeta(headers);

    try {
      const result = await sendTo<any>(
        this.authClient,
        AUTH_PATTERNS.REGISTER,
        body,
        meta,
        RPC_TIMEOUTS.auth,
      );

      return {
        data: result,
        meta: { requestId },
      };
    } catch (error) {
      normalizeErrorResponse(error, requestId);
    }
  }

  @Post('auth/login')
  async login(
    @Body() body: any,
    @Headers() headers: GatewayHeaders,
  ): Promise<ApiSuccessResponse<any>> {
    const requestId = getRequestId(headers);
    const meta = this.buildMeta(headers, null);

    try {
      const result = await sendTo<any>(
        this.authClient,
        AUTH_PATTERNS.LOGIN,
        body,
        meta,
        RPC_TIMEOUTS.auth,
      );

      return {
        data: result,
        meta: { requestId },
      };
    } catch (error) {
      normalizeErrorResponse(error, requestId);
    }
  }

  @Post('auth/refresh')
  async refresh(
    @Body() body: any,
    @Headers() headers: GatewayHeaders,
  ): Promise<ApiSuccessResponse<any>> {
    const requestId = getRequestId(headers);
    const meta = this.buildMeta(headers, null);

    try {
      const result = await sendTo<any>(
        this.authClient,
        AUTH_PATTERNS.REFRESH,
        body,
        meta,
        RPC_TIMEOUTS.auth,
      );

      return {
        data: result,
        meta: { requestId },
      };
    } catch (error) {
      normalizeErrorResponse(error, requestId);
    }
  }

  @Get('users/me')
  async me(@Headers() headers: GatewayHeaders): Promise<ApiSuccessResponse<any>> {
    const requestId = getRequestId(headers);
    const actor = await verifyActor(this.authClient, headers);

    const profile = await sendTo<any>(
      this.userClient,
      'user.profile.get',
      { userId: actor.userId },
      this.buildMeta(headers, actor),
      RPC_TIMEOUTS.user,
    );

    return {
      data: profile,
      meta: { requestId },
    };
  }

  @Patch('users/me/profile')
  async updateProfile(
    @Body() body: any,
    @Headers() headers: GatewayHeaders,
  ): Promise<ApiSuccessResponse<any>> {
    const requestId = getRequestId(headers);
    const actor = await verifyActor(this.authClient, headers);

    const allowedRoles: UserRole[] = ['student', 'teacher', 'admin', 'developer'];
    if (!allowedRoles.includes(actor.role)) {
      throw new HttpException(
        {
          error: {
            code: 'FORBIDDEN',
            message: 'Role tidak diizinkan melakukan operasi ini.',
          },
          meta: { requestId },
        },
        HttpStatus.FORBIDDEN,
      );
    }

    const profile = await sendTo<any>(
      this.userClient,
      'user.profile.update',
      {
        userId: actor.userId,
        fullName: body.fullName,
        phone: body.phone,
        avatarUrl: body.avatarUrl,
        schoolName: body.schoolName,
        educationLevel: body.educationLevel,
      },
      this.buildMeta(headers, actor),
      RPC_TIMEOUTS.user,
    );

    return {
      data: profile,
      meta: { requestId },
    };
  }

  // Contoh route belajar
  @Get('learning/education-levels')
  async educationLevels(@Headers() headers: GatewayHeaders) {
    const requestId = getRequestId(headers);
    const actor = await verifyActor(this.authClient, headers).catch(() => null);

    const data = await sendTo<any>(
      this.learningClient,
      'learning.educationLevel.list',
      { level: null },
      this.buildMeta(headers, actor),
      RPC_TIMEOUTS.learningRead,
    );

    return { data, meta: { requestId } };
  }

  @Get('learning/curricula')
  async curricula(
    @Req() req: any,
    @Headers() headers: GatewayHeaders,
  ) {
    const requestId = getRequestId(headers);
    const actor = await verifyActor(this.authClient, headers).catch(() => null);

    const data = await sendTo<any>(
      this.learningClient,
      'learning.curriculum.list',
      {
        level: req.query.level ?? 'SMA',
        search: req.query.search ?? undefined,
      },
      this.buildMeta(headers, actor),
      RPC_TIMEOUTS.learningRead,
    );

    return { data, meta: { requestId } };
  }

  @Get('learning/materials/:materialId')
  async learningMaterialDetail(
    @Req() req: any,
    @Headers() headers: GatewayHeaders,
  ) {
    const requestId = getRequestId(headers);
    const actor = await verifyActor(this.authClient, headers).catch(() => null);

    const data = await sendTo<any>(
      this.learningClient,
      'learning.material.getDetail',
      {
        materialId: req.params.materialId,
      },
      this.buildMeta(headers, actor),
      RPC_TIMEOUTS.learningRead,
    );

    return { data, meta: { requestId } };
  }

  @Get('game/templates')
  gameTemplates(
    @Query() query: Record<string, string | undefined>,
    @Headers() headers: GatewayHeaders,
  ) {
    return this.gameModuleForward(headers, GAME_PATTERNS.TEMPLATE_LIST, query, true);
  }

  @Get('game/templates/:templateId')
  gameTemplateDetail(
    @Param('templateId') templateId: string,
    @Headers() headers: GatewayHeaders,
  ) {
    return this.gameModuleForward(
      headers,
      GAME_PATTERNS.TEMPLATE_GET_DETAIL,
      { templateId },
      true,
    );
  }

  @Get('game/modules')
  gameModules(
    @Query() query: Record<string, string | undefined>,
    @Headers() headers: GatewayHeaders,
  ) {
    return this.gameModuleForward(headers, GAME_PATTERNS.MODULE_LIST, query);
  }

  @Post('game/modules')
  createGameModule(@Body() body: Record<string, unknown>, @Headers() headers: GatewayHeaders) {
    return this.gameModuleForward(
      headers,
      GAME_PATTERNS.MODULE_CREATE,
      body,
      false,
      RPC_TIMEOUTS.learningWrite,
    );
  }

  @Get('game/modules/:moduleId')
  gameModuleDetail(
    @Param('moduleId') moduleId: string,
    @Headers() headers: GatewayHeaders,
  ) {
    return this.gameModuleForward(headers, GAME_PATTERNS.MODULE_GET_DETAIL, { moduleId });
  }

  @Patch('game/modules/:moduleId')
  updateGameModule(
    @Param('moduleId') moduleId: string,
    @Body() body: Record<string, unknown>,
    @Headers() headers: GatewayHeaders,
  ) {
    return this.gameModuleForward(
      headers,
      GAME_PATTERNS.MODULE_UPDATE,
      { ...body, moduleId },
      false,
      RPC_TIMEOUTS.learningWrite,
    );
  }

  @Delete('game/modules/:moduleId')
  deleteGameModule(
    @Param('moduleId') moduleId: string,
    @Headers() headers: GatewayHeaders,
  ) {
    return this.gameModuleForward(
      headers,
      GAME_PATTERNS.MODULE_DELETE,
      { moduleId },
      false,
      RPC_TIMEOUTS.learningWrite,
    );
  }

  @Post('game/modules/:moduleId/versions')
  createGameVersionDraft(
    @Param('moduleId') moduleId: string,
    @Body() body: Record<string, unknown>,
    @Headers() headers: GatewayHeaders,
  ) {
    return this.gameModuleForward(
      headers,
      GAME_PATTERNS.VERSION_CREATE_DRAFT,
      { ...body, moduleId },
      false,
      RPC_TIMEOUTS.learningWrite,
    );
  }

  @Get('game/versions/:versionId')
  gameVersionDetail(
    @Param('versionId') versionId: string,
    @Headers() headers: GatewayHeaders,
  ) {
    return this.gameModuleForward(headers, GAME_PATTERNS.VERSION_GET_DETAIL, { versionId });
  }

  @Patch('game/versions/:versionId/config')
  updateGameVersionConfig(
    @Param('versionId') versionId: string,
    @Body() body: Record<string, unknown>,
    @Headers() headers: GatewayHeaders,
  ) {
    return this.gameModuleForward(
      headers,
      GAME_PATTERNS.VERSION_UPDATE_CONFIG,
      { ...body, versionId },
      false,
      RPC_TIMEOUTS.learningWrite,
    );
  }

  @Put('game/versions/:versionId/files')
  saveGameVersionFiles(
    @Param('versionId') versionId: string,
    @Body() body: Record<string, unknown>,
    @Headers() headers: GatewayHeaders,
  ) {
    return this.gameModuleForward(
      headers,
      GAME_PATTERNS.VERSION_SAVE_CUSTOM_FILES,
      { ...body, versionId },
      false,
      RPC_TIMEOUTS.learningWrite,
    );
  }

  @Post('game/versions/:versionId/publish')
  publishGameVersion(
    @Param('versionId') versionId: string,
    @Body() body: Record<string, unknown>,
    @Headers() headers: GatewayHeaders,
  ) {
    return this.gameModuleForward(
      headers,
      GAME_PATTERNS.VERSION_PUBLISH,
      { ...body, versionId },
      false,
      RPC_TIMEOUTS.learningWrite,
    );
  }

  @Get('game/player/:versionId')
  gamePlayerPayload(
    @Param('versionId') versionId: string,
    @Headers() headers: GatewayHeaders,
  ) {
    return this.gameModuleForward(
      headers,
      GAME_PATTERNS.PLAYER_GET_PAYLOAD,
      { versionId },
      true,
      RPC_TIMEOUTS.learningRead,
    );
  }

  // Contoh AI route di Gateway
  @Post('ai/generate')
  async aiGenerate(@Body() body: any, @Headers() headers: GatewayHeaders) {
    const requestId = getRequestId(headers);
    const actor = await verifyActor(this.authClient, headers).catch(() => null);

    const data = await sendTo<any>(
      this.aiClient,
      'ai.generate',
      body,
      this.buildMeta(headers, actor),
      RPC_TIMEOUTS.aiAgent,
    );

    return { data, meta: { requestId } };
  }

  @Post('progress/submissions')
  async createSubmission(@Body() body: any, @Headers() headers: GatewayHeaders) {
    const requestId = getRequestId(headers);
    const actor = await verifyActor(this.authClient, headers);

    const data = await sendTo<any>(
      this.progressClient,
      'progress.submission.create',
      body,
      this.buildMeta(headers, actor),
      RPC_TIMEOUTS.progressTransaction,
    );

    return { data, meta: { requestId } };
  }
}