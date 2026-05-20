import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

interface MultipartExceptionShape {
  code?: string;
  statusCode?: number;
}

function isMultipartException(exception: unknown): exception is MultipartExceptionShape {
  return typeof exception === 'object' && exception !== null;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = '服务器内部错误';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      message = typeof res === 'string' ? res : (res as Record<string, unknown>).message as string || message;
    } else {
      // Handle non-HttpException errors (e.g. fastify/multipart errors)
      if (
        isMultipartException(exception) &&
        (exception.code === 'FST_REQ_FILE_TOO_LARGE' || exception.statusCode === 413)
      ) {
        status = HttpStatus.PAYLOAD_TOO_LARGE;
        message = '上传文件大小超过服务器限制';
      } else if (
        isMultipartException(exception) &&
        exception.code === 'FST_INVALID_MULTIPART_CONTENT_TYPE'
      ) {
        status = HttpStatus.BAD_REQUEST;
        message = '请求格式错误：需要 multipart/form-data';
      } else {
        // Don't leak raw error messages to clients
        message = '服务器内部错误';
      }
    }

    this.logger.error(`[${status}] ${Array.isArray(message) ? message.join('; ') : message}`);
    response.status(status).send({
      code: status,
      message: Array.isArray(message) ? message.join('; ') : message,
      data: null,
    });
  }
}
