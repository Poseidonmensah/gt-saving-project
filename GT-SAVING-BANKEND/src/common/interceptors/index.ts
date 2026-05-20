import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  meta?: Record<string, any>;
  timestamp: string;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => {
        // If data already has success field, pass through
        if (data && typeof data === 'object' && 'success' in data) return data;

        return {
          success: true,
          data: data?.data !== undefined ? data.data : data,
          message: data?.message,
          meta: data?.meta,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, user, ip } = request;
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse();
          const duration = Date.now() - startTime;
          this.logger.log(
            `${method} ${url} ${response.statusCode} ${duration}ms [${user?.username || 'anonymous'}] [${ip}]`
          );
        },
        error: (err) => {
          const duration = Date.now() - startTime;
          this.logger.warn(
            `${method} ${url} ${err.status || 500} ${duration}ms [${user?.username || 'anonymous'}] ERROR: ${err.message}`
          );
        },
      }),
    );
  }
}