// ============================================================
// src/modules/auth/auth.module.ts
// ============================================================
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { UserEntity } from '../users/entities/user.entity';
import { UserSessionEntity } from '../users/entities/user-session.entity';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity, UserSessionEntity]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET'),
        signOptions: { expiresIn: config.get('JWT_EXPIRES_IN', '8h') },
      }),
    }),
    AuditModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, LocalStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}

// ============================================================
// src/modules/auth/auth.service.ts
// ============================================================
import {
  Injectable, UnauthorizedException, ForbiddenException,
  BadRequestException, ConflictException, Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as speakeasy from 'speakeasy';
import * as qrcode from 'qrcode';
import { UserEntity } from '../users/entities/user.entity';
import { UserSessionEntity } from '../users/entities/user-session.entity';
import { AuditService } from '../audit/audit.service';
import { LoginDto } from './dto/login.dto';
import { MfaVerifyDto } from './dto/mfa-verify.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly MFA_REQUIRED_ROLES = ['super_admin', 'admin', 'branch_manager', 'accountant', 'compliance_officer'];

  constructor(
    @InjectRepository(UserEntity) private usersRepo: Repository<UserEntity>,
    @InjectRepository(UserSessionEntity) private sessionsRepo: Repository<UserSessionEntity>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private auditService: AuditService,
  ) {}

  async validateUser(username: string, password: string): Promise<UserEntity> {
    const user = await this.usersRepo.findOne({
      where: [{ username }, { email: username }],
      relations: ['branch'],
    });

    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (user.status === 'locked') {
      throw new ForbiddenException('Account is locked. Contact administrator.');
    }
    if (user.status !== 'active') {
      throw new ForbiddenException(`Account is ${user.status}. Contact administrator.`);
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      await this.handleFailedLogin(user);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Reset failed attempts on successful password
    if (user.failedLoginCount > 0) {
      await this.usersRepo.update(user.userId, { failedLoginCount: 0 });
    }

    return user;
  }

  async login(loginDto: LoginDto, ipAddress: string, userAgent: string) {
    const user = await this.validateUser(loginDto.username, loginDto.password);

    const mfaRequired = this.MFA_REQUIRED_ROLES.includes(user.role) && user.mfaEnabled;

    if (mfaRequired && !loginDto.mfaToken) {
      // Return partial auth token requiring MFA step
      const partialToken = this.jwtService.sign(
        { sub: user.userId, step: 'mfa_required' },
        { expiresIn: '5m' }
      );
      return { mfaRequired: true, partialToken };
    }

    if (mfaRequired && loginDto.mfaToken) {
      const mfaValid = speakeasy.totp.verify({
        secret: user.mfaSecret,
        encoding: 'base32',
        token: loginDto.mfaToken,
        window: 2,
      });
      if (!mfaValid) throw new UnauthorizedException('Invalid MFA token');
    }

    return this.createSession(user, ipAddress, userAgent);
  }

  async createSession(user: UserEntity, ipAddress: string, userAgent: string) {
    const payload = {
      sub: user.userId,
      username: user.username,
      role: user.role,
      branchId: user.branchId,
      mfaVerified: user.mfaEnabled,
      customerId: user.role === 'customer' ? (user as any).customerId : undefined,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(
      { sub: user.userId, type: 'refresh' },
      { secret: this.configService.get('JWT_REFRESH_SECRET'), expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN', '7d') }
    );

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 8);

    const session = this.sessionsRepo.create({
      userId: user.userId,
      tokenHash: await bcrypt.hash(accessToken.split('.')[2], 8),
      refreshTokenHash: await bcrypt.hash(refreshToken.split('.')[2], 8),
      ipAddress,
      userAgent,
      expiresAt,
    });
    await this.sessionsRepo.save(session);

    // Update last login
    await this.usersRepo.update(user.userId, { lastLoginAt: new Date() });

    await this.auditService.log({
      actorUserId: user.userId,
      actorRole: user.role,
      actionType: 'USER_LOGIN',
      entityType: 'user',
      entityId: user.userId,
      ipAddress,
      description: `User ${user.username} logged in`,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 8 * 60 * 60,
      user: {
        userId: user.userId,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        branchId: user.branchId,
        mfaEnabled: user.mfaEnabled,
        mustChangePassword: user.mustChangePassword,
      },
    };
  }

  async logout(userId: string, tokenHash: string) {
    await this.sessionsRepo.update(
      { userId, revokedAt: null as any },
      { revokedAt: new Date() }
    );
    await this.auditService.log({
      actorUserId: userId,
      actorRole: 'unknown',
      actionType: 'USER_LOGOUT',
      entityType: 'user',
      entityId: userId,
    });
  }

  async setupMfa(userId: string) {
    const user = await this.usersRepo.findOneOrFail({ where: { userId } });
    const appName = this.configService.get('MFA_APP_NAME', 'GoodTimeSLS');

    const secret = speakeasy.generateSecret({
      name: `${appName}:${user.email}`,
      length: 32,
    });

    await this.usersRepo.update(userId, { mfaSecret: secret.base32 });

    const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);
    return { secret: secret.base32, qrCode: qrCodeUrl };
  }

  async enableMfa(userId: string, dto: MfaVerifyDto) {
    const user = await this.usersRepo.findOneOrFail({ where: { userId } });
    if (!user.mfaSecret) throw new BadRequestException('MFA not set up. Call /auth/mfa/setup first.');

    const valid = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token: dto.token,
      window: 2,
    });
    if (!valid) throw new BadRequestException('Invalid MFA token');

    await this.usersRepo.update(userId, { mfaEnabled: true });
    return { message: 'MFA enabled successfully' };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.usersRepo.findOneOrFail({ where: { userId } });
    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) throw new BadRequestException('Current password is incorrect');

    if (dto.newPassword === dto.currentPassword) {
      throw new BadRequestException('New password must differ from current password');
    }

    const rounds = this.configService.get<number>('BCRYPT_ROUNDS', 12);
    const hash = await bcrypt.hash(dto.newPassword, rounds);
    await this.usersRepo.update(userId, {
      passwordHash: hash,
      passwordChangedAt: new Date(),
      mustChangePassword: false,
    });

    await this.auditService.log({
      actorUserId: userId,
      actorRole: user.role,
      actionType: 'PASSWORD_CHANGED',
      entityType: 'user',
      entityId: userId,
    });

    return { message: 'Password changed successfully' };
  }

  private async handleFailedLogin(user: UserEntity) {
    const maxAttempts = this.configService.get<number>('MAX_LOGIN_ATTEMPTS', 5);
    const newCount = user.failedLoginCount + 1;

    if (newCount >= maxAttempts) {
      await this.usersRepo.update(user.userId, { status: 'locked', failedLoginCount: newCount });
      await this.auditService.log({
        actorUserId: user.userId,
        actorRole: user.role,
        actionType: 'ACCOUNT_LOCKED',
        entityType: 'user',
        entityId: user.userId,
        description: `Account locked after ${maxAttempts} failed login attempts`,
      });
    } else {
      await this.usersRepo.update(user.userId, { failedLoginCount: newCount });
    }
  }
}

// ============================================================
// src/modules/auth/auth.controller.ts
// ============================================================
import {
  Controller, Post, Body, Get, UseGuards, Req,
  HttpCode, HttpStatus, Patch,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { MfaVerifyDto } from './dto/mfa-verify.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from '../../common/guards';
import { CurrentUser } from '../../common/decorators';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Login with username/password and optional MFA token' })
  async login(@Body() dto: LoginDto, @Req() req: any) {
    return this.authService.login(dto, req.ip, req.headers['user-agent']);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser() user: any, @Req() req: any) {
    await this.authService.logout(user.userId, req.headers.authorization);
    return { message: 'Logged out successfully' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  getProfile(@CurrentUser() user: any) {
    return user;
  }

  @Get('mfa/setup')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Generate MFA secret and QR code for setup' })
  setupMfa(@CurrentUser('userId') userId: string) {
    return this.authService.setupMfa(userId);
  }

  @Post('mfa/enable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Enable MFA by verifying TOTP token' })
  @HttpCode(HttpStatus.OK)
  enableMfa(@CurrentUser('userId') userId: string, @Body() dto: MfaVerifyDto) {
    return this.authService.enableMfa(userId, dto);
  }

  @Patch('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  changePassword(@CurrentUser('userId') userId: string, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(userId, dto);
  }
}

// ============================================================
// src/modules/auth/dto/login.dto.ts
// ============================================================
import { IsString, MinLength, IsOptional, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'john.doe' })
  @IsString()
  username: string;

  @ApiProperty({ example: 'SecureP@ss1' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: '123456', required: false })
  @IsOptional()
  @IsString()
  @Length(6, 6)
  mfaToken?: string;
}

export class MfaVerifyDto {
  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6)
  token: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  currentPassword: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  newPassword: string;
}

// ============================================================
// src/modules/auth/strategies/jwt.strategy.ts
// ============================================================
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../../users/entities/user.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    @InjectRepository(UserEntity) private usersRepo: Repository<UserEntity>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    if (payload.step === 'mfa_required') return { mfaStep: true, userId: payload.sub };

    const user = await this.usersRepo.findOne({ where: { userId: payload.sub } });
    if (!user || user.status !== 'active') throw new UnauthorizedException('User not active');

    return {
      userId: user.userId,
      username: user.username,
      role: user.role,
      branchId: user.branchId,
      mfaVerified: payload.mfaVerified,
      fullName: user.fullName,
      email: user.email,
    };
  }
}

// ============================================================
// src/modules/auth/strategies/local.strategy.ts
// ============================================================
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({ usernameField: 'username' });
  }

  async validate(username: string, password: string) {
    return this.authService.validateUser(username, password);
  }
}
