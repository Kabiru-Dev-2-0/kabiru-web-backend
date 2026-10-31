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
  'POST /learning/subjects': LEARNING_PATTERNS.SUBJECT_CREATE,
  'GET /learning/topics': LEARNING_PATTERNS.TOPIC_LIST,
  'POST /learning/topics': LEARNING_PATTERNS.TOPIC_CREATE,
  'GET /learning/materials': LEARNING_PATTERNS.MATERIAL_LIST,
  'POST /learning/materials': LEARNING_PATTERNS.MATERIAL_CREATE,
};

function matchRoute(
  method: string,
  pathname: string,
): { pattern: string; params: Record<string, string> } | null {
  const staticPattern = ROUTE_MAP[`${method} ${pathname}`];
  if (staticPattern) {
    return { pattern: staticPattern, params: {} };
  }

  // Parameterized routes:
  const authoringMatch = /^\/learning\/materials\/([^/]+)\/authoring$/.exec(pathname);
  if (method === 'GET' && authoringMatch?.[1]) {
    return {
      pattern: LEARNING_PATTERNS.MATERIAL_GET_AUTHORING,
      params: { materialId: decodeURIComponent(authoringMatch[1]) },
    };
  }

  const materialMatch = /^\/learning\/materials\/([^/]+)$/.exec(pathname);
  if (materialMatch?.[1]) {
    const materialId = decodeURIComponent(materialMatch[1]);
    if (method === 'GET') return { pattern: LEARNING_PATTERNS.MATERIAL_GET_DETAIL, params: { materialId } };
    if (method === 'PATCH') return { pattern: LEARNING_PATTERNS.MATERIAL_UPDATE, params: { materialId } };
    if (method === 'DELETE') return { pattern: LEARNING_PATTERNS.MATERIAL_DELETE, params: { materialId } };
  }

  const topicMatch = /^\/learning\/topics\/([^/]+)$/.exec(pathname);
  if (topicMatch?.[1]) {
    const topicId = decodeURIComponent(topicMatch[1]);
    if (method === 'PATCH') return { pattern: LEARNING_PATTERNS.TOPIC_UPDATE, params: { topicId } };
    if (method === 'DELETE') return { pattern: LEARNING_PATTERNS.TOPIC_DELETE, params: { topicId } };
  }

  const subjectMatch = /^\/learning\/subjects\/([^/]+)$/.exec(pathname);
  if (subjectMatch?.[1]) {
    const subjectId = decodeURIComponent(subjectMatch[1]);
    if (method === 'PATCH') return { pattern: LEARNING_PATTERNS.SUBJECT_UPDATE, params: { subjectId } };
    if (method === 'DELETE') return { pattern: LEARNING_PATTERNS.SUBJECT_DELETE, params: { subjectId } };
  }

  return null;
}

function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  if (req.method !== 'POST' && req.method !== 'PATCH') {
    return Promise.resolve({});
  }
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
  });
}

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
  const method = req.method ?? 'GET';
  const routeKey = `${method} ${parsedUrl.pathname}`;
  const matched = matchRoute(method, parsedUrl.pathname);

  if (!matched) {
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

  const body = await readJsonBody(req);
  const envelope: InternalRequest<Record<string, unknown>> = {
    meta: {
      requestId,
      actor: resolveActor(req),
      callerService: 'api-gateway',
    },
    data: { ...queryData, ...matched.params, ...body },
  };

  try {
    const result = await firstValueFrom(
      tcpClient.send<unknown>(matched.pattern, envelope).pipe(timeout(5000)),
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