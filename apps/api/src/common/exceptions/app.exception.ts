import { HttpException } from '@nestjs/common';

/**
 * Standard application exception.
 * Always includes machine-readable `code` and i18n key for frontend translation.
 */
export class AppException extends HttpException {
  constructor(
    public readonly code: string,
    message: string,
    statusCode: number,
    public readonly i18nKey: string = code.toLowerCase(),
  ) {
    super({ code, message, i18nKey }, statusCode);
  }
}
