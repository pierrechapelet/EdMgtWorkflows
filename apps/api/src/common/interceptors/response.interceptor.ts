import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

type WrappedResponse<T> = {
  data: T;
  meta?: Record<string, unknown>;
};

/**
 * Wraps all successful responses in the standard { data, meta? } envelope.
 * Responses that already contain a `data` key are passed through unchanged
 * (e.g., paginated responses that include meta).
 */
@Injectable()
export class ResponseInterceptor<T>
  implements NestInterceptor<T, WrappedResponse<T>>
{
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<WrappedResponse<T>> {
    return next.handle().pipe(
      map((value) => {
        if (
          value !== null &&
          typeof value === 'object' &&
          'data' in (value as object)
        ) {
          return value as WrappedResponse<T>;
        }
        return { data: value as T };
      }),
    );
  }
}
