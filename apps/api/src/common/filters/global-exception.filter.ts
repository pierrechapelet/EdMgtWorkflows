import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let error: { code: string; message: string; i18nKey: string } = {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      i18nKey: 'internal_error',
    };

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const body = exception.getResponse();

      if (typeof body === 'object' && body !== null) {
        const { code, message, i18nKey } = body as Record<string, unknown>;
        error = {
          code: typeof code === 'string' ? code : 'HTTP_ERROR',
          message: typeof message === 'string' ? message : exception.message,
          i18nKey: typeof i18nKey === 'string' ? i18nKey : 'http_error',
        };
      } else {
        error = {
          code: 'HTTP_ERROR',
          message: String(body),
          i18nKey: 'http_error',
        };
      }
    } else {
      // Unexpected server error — log full stack
      this.logger.error(
        `Unhandled exception on ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(statusCode).json({
      error,
      meta: {
        timestamp: new Date().toISOString(),
        path: request.url,
        method: request.method,
      },
    });
  }
}
