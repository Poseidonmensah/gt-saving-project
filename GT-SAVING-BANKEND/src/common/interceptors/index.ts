import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';

@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(map((data) => ({ success: true, data: data?.data ?? data, timestamp: new Date().toISOString() })));
  }
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const { method, url, ip } = context.switchToHttp().getRequest();
    const start = Date.now();
    return next.handle().pipe(tap(() => this.logger.log(`${method} ${url} ${Date.now() - start}ms [${ip}]`)));
  }
}