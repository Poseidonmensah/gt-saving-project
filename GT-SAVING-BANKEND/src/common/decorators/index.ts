// ============================================================
// src/common/decorators/roles.decorator.ts
// ============================================================
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

// ============================================================
// src/common/decorators/current-user.decorator.ts
// ============================================================
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: string, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);

// ============================================================
// src/common/decorators/idempotency.decorator.ts
// ============================================================
export const IDEMPOTENCY_KEY = 'X-Idempotency-Key';

export const IdempotencyKey = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.headers[IDEMPOTENCY_KEY.toLowerCase()];
  },
);
