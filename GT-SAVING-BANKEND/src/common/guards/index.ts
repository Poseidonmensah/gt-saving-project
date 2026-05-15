import {
  Injectable, CanActivate, ExecutionContext,
  UnauthorizedException, ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { ROLES_KEY } from '../decorators';

// ============================================================
// JWT Auth Guard
// ============================================================
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) { super(); }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      throw err || new UnauthorizedException('Invalid or expired token');
    }
    return user;
  }
}

// ============================================================
// RBAC Roles Guard
// ============================================================
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user) throw new UnauthorizedException('Authentication required');

    const hasRole = requiredRoles.some(role => user.role === role);
    if (!hasRole) {
      throw new ForbiddenException(
        `Access denied. Required roles: ${requiredRoles.join(', ')}. Your role: ${user.role}`
      );
    }
    return true;
  }
}

// ============================================================
// MFA Guard — enforced for privileged roles
// ============================================================
@Injectable()
export class MfaGuard implements CanActivate {
  private readonly mfaRequiredRoles = [
    'super_admin', 'admin', 'branch_manager', 'accountant', 'compliance_officer',
  ];

  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest();
    if (!user) return false;

    if (this.mfaRequiredRoles.includes(user.role)) {
      if (!user.mfaVerified) {
        throw new ForbiddenException('MFA verification required for this operation');
      }
    }
    return true;
  }
}

// ============================================================
// Self-Approval Prevention Guard
// ============================================================
@Injectable()
export class NoSelfApprovalGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const { user, body, params } = request;

    // Check if user is trying to approve their own request
    if (body?.requestorId && body.requestorId === user?.userId) {
      throw new ForbiddenException('You cannot approve your own request');
    }
    return true;
  }
}
