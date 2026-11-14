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
  UnauthorizedException,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { randomUUID } from 'node:crypto';
import { firstValueFrom, timeout as rxTimeout, TimeoutError } from 'rxjs';
import {
  AUTH_PATTERNS,
  GAME_PATTERNS,
  LEARNING_PATTERNS,
  USER_ROLES,
  type ActorContext,
  type ApiSuccessResponse,
  type InternalRequest,
  type PaginationMeta,
  type UserRole,
} from '@kabiru/contracts';

type GatewayHeaders = Record<string, string | undefined>;
type JsonBody = Record<string, unknown>;
type QueryParams = Record<string, string | undefined>;

// Pattern ai-service belum dipindah ke @kabiru/contracts; dikumpulkan di sini agar tidak ada magic string tersebar.
const AI_PATTERNS = {
  HEALTH_CHECK: 'ai.health.check',
  OLLAMA_STATUS: 'ai.ollama.status',
  GENERATE: 'ai.generate',
  SUBMIT: 'ai.submit',
} as const;

const USER_PATTERNS = {
  PROFILE_CREATE: 'user.profile.create',
  PROFILE_GET: 'user.profile.get',
  PROFILE_UPDATE: 'user.profile.update',
} as const;

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

/**
 * Simulasi role via header (x-dev-role / Bearer <role>) hanya aktif jika:
 * 1) NODE_ENV bukan 'production', DAN
 * 2) ENABLE_DEV_ACTOR_HEADERS=true diset eksplisit.
 * Opt-in ganda ini mencegah fallback ikut aktif di production hanya karena NODE_ENV lupa diset.
 */
const DEV_ACTOR_HEADERS_ENABLED =
  process.env.NODE_ENV !== 'production' && process.env.ENABLE_DEV_ACTOR_HEADERS === 'true';

const DEV_FALLBACK_USER_ID = '00000000-0000-4000-8000-000000000001';

const ROLE_ALIASES: Readonly<Record<string, UserRole>> = {
  student: 'student',
  siswa: 'student',
  teacher: 'teacher',
  guru: 'teacher',
  admin: 'admin',
  developer: 'developer',
  dev: 'developer',
};

interface PaginatedPayload {
  items: unknown[];
  pagination: PaginationMeta;
}

interface ForwardOptions {
  /** true = actor opsional (endpoint publik), false = wajib login. */
  allowAnonymous?: boolean;
  timeoutMs?: number;
  /** Actor yang sudah di-resolve sebelumnya, agar tidak verifikasi token dua kali dalam satu request. */
  actor?: ActorContext | null;
}

function normalizeRequestId(input?: string) {
  return input && /^[0-9a-fA-F-]{36}$/.test(input) ? input : randomUUID();
}

function getRequestId(headers: GatewayHeaders) {
  return normalizeRequestId(headers['x-request-id'] ?? headers['X-Request-Id']);
}

function extractBearerToken(headers: GatewayHeaders): string {
  const auth = headers.authorization ?? headers.Authorization;
  if (!auth || !/^Bearer\s+/i.test(auth)) {
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

function isPaginatedPayload(value: unknown): value is PaginatedPayload {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    Array.isArray(candidate.items) &&
    typeof candidate.pagination === 'object' &&
    candidate.pagination !== null
  );
}

/** Samakan bentuk response dengan dev-http-bridge: list paginated diratakan ke `data` + `meta.pagination`. */
function formatSuccessResponse(requestId: string, result: unknown): ApiSuccessResponse<unknown> {
  if (isPaginatedPayload(result)) {
    return { data: result.items, meta: { requestId, pagination: result.pagination } };
  }
  return { data: result, meta: { requestId } };
}

function normalizeErrorResponse(error: unknown, requestId: string): never {
  // HttpException yang sudah dibentuk di gateway (mis. 401 dari verifyActor) diteruskan apa adanya.
  // Tanpa guard ini, exception tersebut jatuh ke cabang terakhir dan berubah jadi 500.
  if (error instanceof HttpException) {
    throw error;
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

  const raw = error as Record<string, unknown> | null | undefined;
  const payload = (raw?.response ?? raw?.error ?? raw) as Record<string, unknown> | undefined;

  if (payload && typeof payload === 'object' && 'code' in payload && 'message' in payload) {
    const httpStatus = Number(payload.httpStatus ?? HttpStatus.INTERNAL_SERVER_ERROR);

    throw new HttpException(
      {
        error: {
          code: payload.code ?? 'INTERNAL_ERROR',
          message: payload.message ?? 'Request gagal.',
          details: payload.details ?? undefined,
        },
        meta: { requestId },
      },
      Number.isFinite(httpStatus) ? httpStatus : HttpStatus.INTERNAL_SERVER_ERROR,
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

function resolveDevActor(headers: GatewayHeaders): ActorContext | null {
  if (!DEV_ACTOR_HEADERS_ENABLED) return null;

  const auth = headers.authorization ?? headers.Authorization;
  const bearerValue = auth && /^Bearer\s+/i.test(auth) ? auth.replace(/^Bearer\s+/i, '').trim() : undefined;

  const roleCandidate = (
    headers['x-dev-role'] ??
    headers['x-actor-role'] ??
    headers['x-role'] ??
    bearerValue
  )
    ?.trim()
    .toLowerCase();

  if (!roleCandidate) return null;

  const role =
    ROLE_ALIASES[roleCandidate] ??
    ((USER_ROLES as readonly string[]).includes(roleCandidate) ? (roleCandidate as UserRole) : null);

  // Bearer berisi JWT asli tidak akan cocok dengan alias role, sehingga tetap diverifikasi via auth-service.
  if (!role) return null;

  return {
    userId: headers['x-dev-user-id']?.trim() || headers['x-actor-id']?.trim() || DEV_FALLBACK_USER_ID,
    role,
    educationLevelCode: 'SMA',
  };
}

async function verifyActor(authClient: ClientProxy, headers: GatewayHeaders): Promise<ActorContext> {
  const requestId = getRequestId(headers);
  const token = extractBearerToken(headers);

  try {
    const verified = await firstValueFrom(
      authClient
        .send<{ valid?: boolean; userId?: string; role?: string }>(AUTH_PATTERNS.VERIFY, {
          accessToken: token,
        })
        .pipe(rxTimeout(RPC_TIMEOUTS.auth)),
    );

    if (!verified?.valid || !verified.userId) {
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
    return await firstValueFrom(client.send<T>(pattern, { meta, data }).pipe(rxTimeout(timeoutMs)));
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

  // ==========================================
  // SHARED HELPERS
  // ==========================================

  private buildMeta(headers: GatewayHeaders, actor: ActorContext | null = null): InternalRequest['meta'] {
    return {
      requestId: getRequestId(headers),
      actor,
      callerService: 'api-gateway',
    };
  }

  private async resolveActor(headers: GatewayHeaders, allowAnonymous: boolean): Promise<ActorContext | null> {
    const devActor = resolveDevActor(headers);
    if (devActor) return devActor;

    return allowAnonymous
      ? verifyActor(this.authClient, headers).catch(() => null)
      : verifyActor(this.authClient, headers);
  }

  /** Satu jalur forwarding untuk semua service: resolve actor -> kirim TCP -> format response. */
  private async forward(
    client: ClientProxy,
    headers: GatewayHeaders,
    pattern: string,
    data: unknown,
    { allowAnonymous = false, timeoutMs = RPC_TIMEOUTS.learningRead, actor: preResolved }: ForwardOptions = {},
  ): Promise<ApiSuccessResponse<unknown>> {
    const requestId = getRequestId(headers);
    const actor = preResolved !== undefined ? preResolved : await this.resolveActor(headers, allowAnonymous);
    const result = await sendTo<unknown>(client, pattern, data, this.buildMeta(headers, actor), timeoutMs);
    return formatSuccessResponse(requestId, result);
  }

  /** Forwarding tanpa resolve actor (endpoint auth publik: register/login/refresh). */
  private async forwardPublic(
    client: ClientProxy,
    headers: GatewayHeaders,
    pattern: string,
    data: unknown,
    timeoutMs: number,
  ): Promise<ApiSuccessResponse<unknown>> {
    const requestId = getRequestId(headers);
    const result = await sendTo<unknown>(client, pattern, data, this.buildMeta(headers), timeoutMs);
    return formatSuccessResponse(requestId, result);
  }

  private learningRead(headers: GatewayHeaders, pattern: string, data: unknown, allowAnonymous = true) {
    return this.forward(this.learningClient, headers, pattern, data, {
      allowAnonymous,
      timeoutMs: RPC_TIMEOUTS.learningRead,
    });
  }

  private learningWrite(headers: GatewayHeaders, pattern: string, data: unknown) {
    return this.forward(this.learningClient, headers, pattern, data, {
      allowAnonymous: false,
      timeoutMs: RPC_TIMEOUTS.learningWrite,
    });
  }

  // ==========================================
  // HEALTH
  // ==========================================

  @Get('health')
  health(@Headers() headers: GatewayHeaders) {
    return this.forwardPublic(
      this.learningClient,
      headers,
      LEARNING_PATTERNS.HEALTH_CHECK,
      {},
      RPC_TIMEOUTS.learningRead,
    );
  }

  // ==========================================
  // AUTH
  // ==========================================

  @Post('auth/register')
  async register(@Body() body: JsonBody, @Headers() headers: GatewayHeaders) {
    const requestId = getRequestId(headers);
    const authResult = await sendTo<{
      userId: string;
      role: UserRole;
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
    }>(
      this.authClient,
      AUTH_PATTERNS.REGISTER,
      body,
      this.buildMeta(headers),
      RPC_TIMEOUTS.auth,
    );

    // Orkestrasi profil user di user-service secara otomatis dan idempotent
    try {
      await sendTo<unknown>(
        this.userClient,
        USER_PATTERNS.PROFILE_CREATE,
        {
          userId: authResult.userId,
          fullName: body.fullName,
          role: authResult.role,
        },
        this.buildMeta(headers, { userId: authResult.userId, role: authResult.role }),
        RPC_TIMEOUTS.user,
      );
    } catch (err) {
      // Non-blocking fallback jika user-service gagal atau lambat, log warning
      console.warn('[Gateway] Gagal sinkronisasi profil user baru:', err);
    }

    return formatSuccessResponse(requestId, authResult);
  }

  @Post('auth/login')
  login(@Body() body: JsonBody, @Headers() headers: GatewayHeaders) {
    return this.forwardPublic(this.authClient, headers, AUTH_PATTERNS.LOGIN, body, RPC_TIMEOUTS.auth);
  }

  @Post('auth/refresh')
  refresh(@Body() body: JsonBody, @Headers() headers: GatewayHeaders) {
    return this.forwardPublic(this.authClient, headers, AUTH_PATTERNS.REFRESH, body, RPC_TIMEOUTS.auth);
  }

  // ==========================================
  // USERS
  // ==========================================

  @Get('users/me')
  async me(@Headers() headers: GatewayHeaders) {
    const actor = await this.resolveActor(headers, false);
    return this.forward(
      this.userClient,
      headers,
      USER_PATTERNS.PROFILE_GET,
      { userId: actor?.userId },
      { timeoutMs: RPC_TIMEOUTS.user, actor },
    );
  }

  @Patch('users/me/profile')
  async updateProfile(@Body() body: JsonBody, @Headers() headers: GatewayHeaders) {
    // Semua role valid boleh update profil sendiri; userId selalu diambil dari token, bukan dari body.
    const actor = await this.resolveActor(headers, false);
    return this.forward(
      this.userClient,
      headers,
      USER_PATTERNS.PROFILE_UPDATE,
      {
        userId: actor?.userId,
        fullName: body.fullName,
        phone: body.phone,
        avatarUrl: body.avatarUrl,
        schoolName: body.schoolName,
        educationLevel: body.educationLevel,
      },
      { timeoutMs: RPC_TIMEOUTS.user, actor },
    );
  }

  // ==========================================
  // LEARNING: READ (Siswa, Guru, Publik)
  // ==========================================

  @Get('learning/education-levels')
  educationLevels(@Headers() headers: GatewayHeaders) {
    return this.learningRead(headers, LEARNING_PATTERNS.EDUCATION_LEVEL_LIST, {});
  }

  @Get('learning/subjects')
  subjects(@Query() query: QueryParams, @Headers() headers: GatewayHeaders) {
    return this.learningRead(headers, LEARNING_PATTERNS.SUBJECT_LIST, query);
  }

  /**
   * @deprecated Alias lama. Sebelumnya mengirim pattern 'learning.curriculum.list' yang tidak punya handler
   * (selalu 504). Sekarang diarahkan ke SUBJECT_LIST. Frontend baru gunakan GET /learning/subjects.
   */
  @Get('learning/curricula')
  curricula(@Query() query: QueryParams, @Headers() headers: GatewayHeaders) {
    return this.learningRead(headers, LEARNING_PATTERNS.SUBJECT_LIST, query);
  }

  @Get('learning/topics')
  topics(@Query() query: QueryParams, @Headers() headers: GatewayHeaders) {
    return this.learningRead(headers, LEARNING_PATTERNS.TOPIC_LIST, query);
  }

  @Get('learning/materials')
  materials(@Query() query: QueryParams, @Headers() headers: GatewayHeaders) {
    return this.learningRead(headers, LEARNING_PATTERNS.MATERIAL_LIST, query);
  }

  // Route statis '/authoring' dideklarasikan sebelum ':materialId' agar urutan matching eksplisit.
  @Get('learning/materials/:materialId/authoring')
  materialAuthoringDetail(@Param('materialId') materialId: string, @Headers() headers: GatewayHeaders) {
    return this.learningRead(headers, LEARNING_PATTERNS.MATERIAL_GET_AUTHORING, { materialId }, false);
  }

  @Get('learning/materials/:materialId')
  materialDetail(@Param('materialId') materialId: string, @Headers() headers: GatewayHeaders) {
    return this.learningRead(headers, LEARNING_PATTERNS.MATERIAL_GET_DETAIL, { materialId });
  }

  // ==========================================
  // LEARNING: AUTHORING CRUD (Guru, Admin, Developer)
  // ==========================================

  @Post('learning/subjects')
  createSubject(@Body() body: JsonBody, @Headers() headers: GatewayHeaders) {
    return this.learningWrite(headers, LEARNING_PATTERNS.SUBJECT_CREATE, body);
  }

  @Patch('learning/subjects/:subjectId')
  updateSubject(
    @Param('subjectId') subjectId: string,
    @Body() body: JsonBody,
    @Headers() headers: GatewayHeaders,
  ) {
    return this.learningWrite(headers, LEARNING_PATTERNS.SUBJECT_UPDATE, { ...body, subjectId });
  }

  @Delete('learning/subjects/:subjectId')
  deleteSubject(@Param('subjectId') subjectId: string, @Headers() headers: GatewayHeaders) {
    return this.learningWrite(headers, LEARNING_PATTERNS.SUBJECT_DELETE, { subjectId });
  }

  @Post('learning/topics')
  createTopic(@Body() body: JsonBody, @Headers() headers: GatewayHeaders) {
    return this.learningWrite(headers, LEARNING_PATTERNS.TOPIC_CREATE, body);
  }

  @Patch('learning/topics/:topicId')
  updateTopic(@Param('topicId') topicId: string, @Body() body: JsonBody, @Headers() headers: GatewayHeaders) {
    return this.learningWrite(headers, LEARNING_PATTERNS.TOPIC_UPDATE, { ...body, topicId });
  }

  @Delete('learning/topics/:topicId')
  deleteTopic(@Param('topicId') topicId: string, @Headers() headers: GatewayHeaders) {
    return this.learningWrite(headers, LEARNING_PATTERNS.TOPIC_DELETE, { topicId });
  }

  @Post('learning/materials')
  createMaterial(@Body() body: JsonBody, @Headers() headers: GatewayHeaders) {
    return this.learningWrite(headers, LEARNING_PATTERNS.MATERIAL_CREATE, body);
  }

  @Patch('learning/materials/:materialId')
  updateMaterial(
    @Param('materialId') materialId: string,
    @Body() body: JsonBody,
    @Headers() headers: GatewayHeaders,
  ) {
    return this.learningWrite(headers, LEARNING_PATTERNS.MATERIAL_UPDATE, { ...body, materialId });
  }

  @Delete('learning/materials/:materialId')
  deleteMaterial(@Param('materialId') materialId: string, @Headers() headers: GatewayHeaders) {
    return this.learningWrite(headers, LEARNING_PATTERNS.MATERIAL_DELETE, { materialId });
  }

  // ==========================================
  // LEARNING: ASSET STORAGE
  // ==========================================

  @Post('learning/assets')
  uploadAsset(@Body() body: JsonBody, @Headers() headers: GatewayHeaders) {
    return this.learningWrite(headers, LEARNING_PATTERNS.ASSET_UPLOAD, body);
  }

  @Get('learning/assets/:assetId')
  assetDetail(@Param('assetId') assetId: string, @Headers() headers: GatewayHeaders) {
    return this.learningRead(headers, LEARNING_PATTERNS.ASSET_GET_DETAIL, { assetId });
  }

  // ==========================================
  // GAME MODULE STUDIO: TEMPLATE CATALOG
  // ==========================================

  @Get('game/templates')
  gameTemplates(@Query() query: QueryParams, @Headers() headers: GatewayHeaders) {
    return this.learningRead(headers, GAME_PATTERNS.TEMPLATE_LIST, query);
  }

  @Get('game/templates/:templateId')
  gameTemplateDetail(@Param('templateId') templateId: string, @Headers() headers: GatewayHeaders) {
    return this.learningRead(headers, GAME_PATTERNS.TEMPLATE_GET_DETAIL, { templateId });
  }

  // ==========================================
  // GAME MODULE STUDIO: MODULE CRUD
  // ==========================================

  @Get('game/modules')
  gameModules(@Query() query: QueryParams, @Headers() headers: GatewayHeaders) {
    return this.learningRead(headers, GAME_PATTERNS.MODULE_LIST, query, false);
  }

  @Post('game/modules')
  createGameModule(@Body() body: JsonBody, @Headers() headers: GatewayHeaders) {
    return this.learningWrite(headers, GAME_PATTERNS.MODULE_CREATE, body);
  }

  @Get('game/modules/:moduleId')
  gameModuleDetail(@Param('moduleId') moduleId: string, @Headers() headers: GatewayHeaders) {
    return this.learningRead(headers, GAME_PATTERNS.MODULE_GET_DETAIL, { moduleId }, false);
  }

  @Patch('game/modules/:moduleId')
  updateGameModule(
    @Param('moduleId') moduleId: string,
    @Body() body: JsonBody,
    @Headers() headers: GatewayHeaders,
  ) {
    return this.learningWrite(headers, GAME_PATTERNS.MODULE_UPDATE, { ...body, moduleId });
  }

  @Delete('game/modules/:moduleId')
  deleteGameModule(@Param('moduleId') moduleId: string, @Headers() headers: GatewayHeaders) {
    return this.learningWrite(headers, GAME_PATTERNS.MODULE_DELETE, { moduleId });
  }

  // ==========================================
  // GAME MODULE STUDIO: VERSIONING & AUTHORING
  // ==========================================

  @Post('game/modules/:moduleId/versions')
  createGameVersionDraft(
    @Param('moduleId') moduleId: string,
    @Body() body: JsonBody,
    @Headers() headers: GatewayHeaders,
  ) {
    return this.learningWrite(headers, GAME_PATTERNS.VERSION_CREATE_DRAFT, { ...body, moduleId });
  }

  @Get('game/versions/:versionId')
  gameVersionDetail(@Param('versionId') versionId: string, @Headers() headers: GatewayHeaders) {
    return this.learningRead(headers, GAME_PATTERNS.VERSION_GET_DETAIL, { versionId }, false);
  }

  @Patch('game/versions/:versionId/config')
  updateGameVersionConfig(
    @Param('versionId') versionId: string,
    @Body() body: JsonBody,
    @Headers() headers: GatewayHeaders,
  ) {
    return this.learningWrite(headers, GAME_PATTERNS.VERSION_UPDATE_CONFIG, { ...body, versionId });
  }

  @Put('game/versions/:versionId/files')
  saveGameVersionFiles(
    @Param('versionId') versionId: string,
    @Body() body: JsonBody,
    @Headers() headers: GatewayHeaders,
  ) {
    return this.learningWrite(headers, GAME_PATTERNS.VERSION_SAVE_CUSTOM_FILES, { ...body, versionId });
  }

  @Post('game/versions/:versionId/publish')
  publishGameVersion(
    @Param('versionId') versionId: string,
    @Body() body: JsonBody,
    @Headers() headers: GatewayHeaders,
  ) {
    return this.learningWrite(headers, GAME_PATTERNS.VERSION_PUBLISH, { ...body, versionId });
  }

  // ==========================================
  // GAME PLAYER (LMS IFRAME RUNTIME)
  // ==========================================

  @Get('game/player/:versionId')
  gamePlayerPayload(@Param('versionId') versionId: string, @Headers() headers: GatewayHeaders) {
    return this.learningRead(headers, GAME_PATTERNS.PLAYER_GET_PAYLOAD, { versionId });
  }

  // ==========================================
  // AI SERVICE
  // ==========================================

  @Get('ai/health')
  aiHealth(@Headers() headers: GatewayHeaders) {
    return this.forwardPublic(this.aiClient, headers, AI_PATTERNS.HEALTH_CHECK, {}, RPC_TIMEOUTS.auth);
  }

  @Get('ai/ollama-status')
  aiOllamaStatus(@Headers() headers: GatewayHeaders) {
    return this.forwardPublic(this.aiClient, headers, AI_PATTERNS.OLLAMA_STATUS, {}, RPC_TIMEOUTS.aiHint);
  }

  @Post('ai/generate')
  aiGenerate(@Body() body: JsonBody, @Headers() headers: GatewayHeaders) {
    return this.forward(this.aiClient, headers, AI_PATTERNS.GENERATE, body, {
      allowAnonymous: true,
      timeoutMs: RPC_TIMEOUTS.aiAgent,
    });
  }

  @Post('ai/submit')
  aiSubmit(@Body() body: JsonBody, @Headers() headers: GatewayHeaders) {
    return this.forward(this.aiClient, headers, AI_PATTERNS.SUBMIT, body, {
      allowAnonymous: false,
      timeoutMs: RPC_TIMEOUTS.aiAgent,
    });
  }

  // ==========================================
  // PROGRESS SERVICE
  // ==========================================

  /**
   * progress-service belum punya handler 'progress.submission.create'.
   * Sebelumnya request ini menggantung sampai timeout (504). Sekarang fail-fast 501 setelah autentikasi,
   * sampai handler di progress-service diimplementasikan.
   */
  @Post('progress/submissions')
  async createSubmission(@Headers() headers: GatewayHeaders) {
    await this.resolveActor(headers, false);
    throw new HttpException(
      {
        error: {
          code: 'NOT_IMPLEMENTED',
          message: 'Endpoint submission belum tersedia di progress-service.',
        },
        meta: { requestId: getRequestId(headers) },
      },
      HttpStatus.NOT_IMPLEMENTED,
    );
  }
}
