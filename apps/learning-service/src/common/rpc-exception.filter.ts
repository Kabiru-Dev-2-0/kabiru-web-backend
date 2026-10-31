import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { createServiceError, isServiceErrorPayload } from '@kabiru/contracts';
import { Observable, throwError } from 'rxjs';

function hasGetError(value: unknown): value is { getError(): unknown } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'getError' in value &&
    typeof (value as { getError?: unknown }).getError === 'function'
  );
}

@Catch()
export class ServiceRpcExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ServiceRpcExceptionFilter.name);

  catch(exception: unknown, _host: ArgumentsHost): Observable<never> {
    if (exception instanceof RpcException || hasGetError(exception)) {
      const errorPayload = exception.getError();
      if (isServiceErrorPayload(errorPayload)) {
        return throwError(() => errorPayload);
      }
      if (typeof errorPayload === 'string') {
        return throwError(() =>
          createServiceError({
            code: 'INTERNAL_ERROR',
            httpStatus: 500,
            message: errorPayload,
          }),
        );
      }
      return throwError(() => errorPayload);
    }

    if (isServiceErrorPayload(exception)) {
      return throwError(() => exception);
    }

    this.logger.error(
      'Unhandled exception pada learning-service',
      exception instanceof Error ? exception.stack : String(exception),
    );

    return throwError(() =>
      createServiceError({
        code: 'INTERNAL_ERROR',
        httpStatus: 500,
        message: 'Terjadi kesalahan internal pada learning-service',
      }),
    );
  }
}