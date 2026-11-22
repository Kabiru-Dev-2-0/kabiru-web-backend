import { RpcException } from '@nestjs/microservices';

export interface ServiceErrorPayload {
  code: string;
  httpStatus: number;
  message: string;
  details?: unknown;
}

export function createRpcError(payload: ServiceErrorPayload): RpcException {
  return new RpcException(payload);
}
