import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { TimeoutError, firstValueFrom, timeout } from 'rxjs';
import {
  LEARNING_PATTERNS,
  USER_ROLES,
  isServiceErrorPayload,
  type ActorContext,
  type ApiErrorResponse,
  type ApiSuccessResponse,
  type InternalRequest,
  type PaginationMeta,
  type UserRole,
} from '@kabiru/contracts';

interface PaginatedPayload {
  items: unknown[];
  pagination: PaginationMeta;
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, x-dev-role, x-dev-user-id, x-request-id',
  'Access-Control-Allow-Private-Network': 'true',
};

function isPaginatedPayload(value: unknown): value is PaginatedPayload {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return Array.isArray(candidate.items) && typeof candidate.pagination === 'object';
}

function resolveActor(req: IncomingMessage): ActorContext | null {
  const rawRole = req.headers['x-dev-role'];
  const roleStr = Array.isArray(rawRole) ? rawRole[0] : rawRole;

  if (!roleStr || roleStr === 'anon' || roleStr === 'null') {
    return null;
  }

  if (!(USER_ROLES as readonly string[]).includes(roleStr)) {
    return null;
  }

  const rawUserId = req.headers['x-dev-user-id'];
  const userId =
    (Array.isArray(rawUserId) ? rawUserId[0] : rawUserId) ??
    '00000000-0000-4000-8000-000000000001';

  return {
    userId,
    role: roleStr as UserRole,
    educationLevelCode: 'SMA',
  };
}

function sendJson(
  res: ServerResponse,
  statusCode: number,
  requestId: string,
  body: ApiSuccessResponse<unknown> | ApiErrorResponse,
): void {
  res.writeHead(statusCode, {
    ...CORS_HEADERS,
    'Content-Type': 'application/json; charset=utf-8',
    'X-Request-Id': requestId,
  });
  res.end(JSON.stringify(body, null, 2));
}

const ROUTE_MAP: Readonly<Record<string, string>> = {
  'GET /health': LEARNING_PATTERNS.HEALTH_CHECK,
  'GET /learning/education-levels': LEARNING_PATTERNS.EDUCATION_LEVEL_LIST,
  'GET /learning/subjects': LEARNING_PATTERNS.SUBJECT_LIST,
  'GET /learning/topics': LEARNING_PATTERNS.TOPIC_LIST,
  'GET /learning/materials': LEARNING_PATTERNS.MATERIAL_LIST,
};

const bridgePort = Number(process.env.DEV_BRIDGE_PORT ?? 3099);
const tcpPort = Number(process.env.SERVICE_PORT ?? 4013);

const tcpClient = ClientProxyFactory.create({
  transport: Transport.TCP,
  options: { host: '127.0.0.1', port: tcpPort },
});

const server = createServer(async (req, res) => {
  const rawReqId = req.headers['x-request-id'];
  const requestId =
    (Array.isArray(rawReqId) ? rawReqId[0] : rawReqId) ?? randomUUID();

  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url ?? '/', `http://localhost:${bridgePort}`);
  const routeKey = `${req.method ?? 'GET'} ${parsedUrl.pathname}`;
  const pattern = ROUTE_MAP[routeKey];

  if (!pattern) {
    sendJson(res, 404, requestId, {
      error: {
        code: 'NOT_FOUND',
        message: `Route ${routeKey} tidak terdaftar di dev-http-bridge`,
      },
      meta: { requestId },
    });
    return;
  }

  const queryData: Record<string, string> = {};
  parsedUrl.searchParams.forEach((value, key) => {
    queryData[key] = value;
  });

  const envelope: InternalRequest<Record<string, string>> = {
    meta: {
      requestId,
      actor: resolveActor(req),
      callerService: 'api-gateway',
    },
    data: queryData,
  };

  try {
    const result = await firstValueFrom(
      tcpClient.send<unknown>(pattern, envelope).pipe(timeout(5000)),
    );

    if (isPaginatedPayload(result)) {
      sendJson(res, 200, requestId, {
        data: result.items,
        meta: { requestId, pagination: result.pagination },
      });
      return;
    }

    sendJson(res, 200, requestId, {
      data: result,
      meta: { requestId },
    });
  } catch (err: unknown) {
    if (err instanceof TimeoutError) {
      sendJson(res, 504, requestId, {
        error: {
          code: 'UPSTREAM_TIMEOUT',
          message: 'learning-service tidak merespons dalam batas 5 detik',
        },
        meta: { requestId },
      });
      return;
    }

    if (isServiceErrorPayload(err)) {
      sendJson(res, err.httpStatus, requestId, {
        error: {
          code: err.code,
          message: err.message,
          ...(err.details ? { details: err.details } : {}),
        },
        meta: { requestId },
      });
      return;
    }

    console.error('[dev-http-bridge] Unhandled TCP error:', err);
    sendJson(res, 500, requestId, {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Terjadi kesalahan internal saat menghubungi learning-service',
      },
      meta: { requestId },
    });
  }
});

server.listen(bridgePort, '127.0.0.1', () => {
  console.log(
    `[dev-http-bridge] Jalan di http://localhost:${bridgePort} -> TCP 127.0.0.1:${tcpPort}`,
  );
  console.log('Simulasi Role di Hoppscotch Header -> x-dev-role: student | teacher');
});