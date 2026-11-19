import { RpcException } from '@nestjs/microservices';
import{
    AUTHORING_ROLES,
    createServiceError,
    formatZodError,
    type ActorContext,
    type InternalRequest,
} from '@kabiru/contracts';

type SafeParseSuccess<T> = {success: true; data: T};
type SafeParseError = {
    success: false;
    error: Parameters<typeof formatZodError>[0];
};

export interface SafeParseableSchema<TOutput>{
    safeParse(input: unknown): SafeParseSuccess<TOutput> | SafeParseError;
};

export function validateRpcData<TOutput>(
    schema: SafeParseableSchema<TOutput>,
    payload: unknown,
): TOutput{
    const rawData =
        typeof payload === 'object' && payload !== null && 'data' in payload
            ? (payload as InternalRequest).data
            : payload;
    
    const result = schema.safeParse(rawData ?? {});
    if (!result.success){
        throw new RpcException(
            createServiceError({
                code: 'VALIDATION_ERROR',
                httpStatus: 400,
                message: 'Input request tidak valid',
                details: formatZodError(result.error),
            }),
        );
    }
    return result.data;
}

export function extractActor(payload: unknown): ActorContext | null{
    if (typeof payload !== 'object' || payload === null || !('meta' in payload)){
        return null;
    }
    const meta = (payload as InternalRequest<unknown>).meta;
    return meta?.actor ?? null;
}

export function canAccessUnpublishedContent(actor: ActorContext | null): boolean {
  if (!actor) return false;
  return AUTHORING_ROLES.includes(actor.role);
}

export function assertAuthorRole(actor: ActorContext | null): ActorContext {
  if (!actor || !AUTHORING_ROLES.includes(actor.role)) {
    throw new RpcException(
      createServiceError({
        code: 'FORBIDDEN',
        httpStatus: 403,
        message: 'Operasi ini memerlukan hak akses pengajar atau admin.',
      }),
    );
  }
  return actor;
}