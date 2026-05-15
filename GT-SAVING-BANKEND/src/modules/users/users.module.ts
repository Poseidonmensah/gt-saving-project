// ============================================================
// src/modules/users/entities/user.entity.ts
// ============================================================
import {
  Entity, PrimaryColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, JoinColumn, OneToMany,
} from 'typeorm';

@Entity('users')
export class UserEntity {
  @PrimaryColumn({ name: 'user_id' }) userId: string;
  @Column({ name: 'username', unique: true }) username: string;
  @Column({ name: 'email', unique: true }) email: string;
  @Column({ name: 'password_hash' }) passwordHash: string;
  @Column({ name: 'full_name' }) fullName: string;
  @Column({ name: 'role' }) role: string;
  @Column({ name: 'branch_id', nullable: true }) branchId: string;
  @Column({ name: 'status', default: 'active' }) status: string;
  @Column({ name: 'mfa_enabled', default: false }) mfaEnabled: boolean;
  @Column({ name: 'mfa_secret', nullable: true }) mfaSecret: string;
  @Column({ name: 'failed_login_count', default: 0 }) failedLoginCount: number;
  @Column({ name: 'last_login_at', nullable: true }) lastLoginAt: Date;
  @Column({ name: 'password_changed_at' }) passwordChangedAt: Date;
  @Column({ name: 'must_change_password', default: true }) mustChangePassword: boolean;
  @Column({ name: 'created_by', nullable: true }) createdBy: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

@Entity('user_sessions')
export class UserSessionEntity {
  @PrimaryColumn({ name: 'session_id' }) sessionId: string;
  @Column({ name: 'user_id' }) userId: string;
  @Column({ name: 'token_hash' }) tokenHash: string;
  @Column({ name: 'refresh_token_hash', nullable: true }) refreshTokenHash: string;
  @Column({ name: 'ip_address', nullable: true }) ipAddress: string;
  @Column({ name: 'device_fingerprint', nullable: true }) deviceFingerprint: string;
  @Column({ name: 'user_agent', nullable: true }) userAgent: string;
  @Column({ name: 'expires_at' }) expiresAt: Date;
  @Column({ name: 'revoked_at', nullable: true }) revokedAt: Date;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

// ============================================================
// src/modules/users/users.module.ts
// ============================================================
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity, UserSessionEntity]), AuditModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService, TypeOrmModule],
})
export class UsersModule {}

// ============================================================
// src/modules/users/users.service.ts
// ============================================================
import {
  Injectable, NotFoundException, ConflictException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { v4 as uuid } from 'uuid';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity) private repo: Repository<UserEntity>,
    private config: ConfigService,
    private audit: AuditService,
  ) {}

  async create(dto: CreateUserDto, createdBy: string): Promise<UserEntity> {
    const existing = await this.repo.findOne({
      where: [{ username: dto.username }, { email: dto.email }],
    });
    if (existing) throw new ConflictException('Username or email already exists');

    const rounds = this.config.get<number>('BCRYPT_ROUNDS', 12);
    const hash = await bcrypt.hash(dto.password, rounds);

    const user = this.repo.create({
      userId: uuid(),
      username: dto.username,
      email: dto.email,
      passwordHash: hash,
      fullName: dto.fullName,
      role: dto.role,
      branchId: dto.branchId,
      status: 'active',
      mfaEnabled: false,
      failedLoginCount: 0,
      passwordChangedAt: new Date(),
      mustChangePassword: true,
      createdBy,
    });

    const saved = await this.repo.save(user);
    await this.audit.log({
      actorUserId: createdBy,
      actorRole: 'admin',
      actionType: 'USER_CREATED',
      entityType: 'user',
      entityId: saved.userId,
      afterValue: { username: saved.username, role: saved.role },
    });
    return saved;
  }

  async findAll(branchId?: string) {
    const where = branchId ? { branchId } : {};
    return this.repo.find({ where, select: ['userId', 'username', 'email', 'fullName', 'role', 'branchId', 'status', 'lastLoginAt', 'createdAt'] });
  }

  async findOne(userId: string) {
    const user = await this.repo.findOne({ where: { userId } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(userId: string, dto: UpdateUserDto, updatedBy: string) {
    const user = await this.findOne(userId);
    const before = { status: user.status, role: user.role };
    Object.assign(user, dto);
    const saved = await this.repo.save(user);
    await this.audit.log({
      actorUserId: updatedBy,
      actorRole: 'admin',
      actionType: 'USER_UPDATED',
      entityType: 'user',
      entityId: userId,
      beforeValue: before,
      afterValue: dto,
    });
    return saved;
  }

  async unlock(userId: string, adminId: string) {
    await this.repo.update(userId, { status: 'active', failedLoginCount: 0 });
    await this.audit.log({
      actorUserId: adminId,
      actorRole: 'admin',
      actionType: 'USER_UNLOCKED',
      entityType: 'user',
      entityId: userId,
    });
    return { message: 'User account unlocked' };
  }

  async resetPassword(userId: string, newPassword: string, adminId: string) {
    const rounds = this.config.get<number>('BCRYPT_ROUNDS', 12);
    const hash = await bcrypt.hash(newPassword, rounds);
    await this.repo.update(userId, { passwordHash: hash, mustChangePassword: true });
    await this.audit.log({
      actorUserId: adminId,
      actorRole: 'admin',
      actionType: 'PASSWORD_RESET',
      entityType: 'user',
      entityId: userId,
    });
    return { message: 'Password reset. User must change on next login.' };
  }
}

// ============================================================
// src/modules/users/users.controller.ts
// ============================================================
import {
  Controller, Get, Post, Body, Patch, Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard, RolesGuard } from '../../common/guards';
import { Roles, CurrentUser } from '../../common/decorators';
import { IsEmail, IsString, MinLength, IsOptional, IsIn } from 'class-validator';

class CreateUserDto {
  @IsString() username: string;
  @IsEmail() email: string;
  @IsString() @MinLength(8) password: string;
  @IsString() fullName: string;
  @IsString() role: string;
  @IsOptional() @IsString() branchId?: string;
}

class UpdateUserDto {
  @IsOptional() @IsString() fullName?: string;
  @IsOptional() @IsString() role?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() branchId?: string;
}

@ApiTags('users')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Post()
  @Roles('super_admin', 'admin')
  create(@Body() dto: CreateUserDto, @CurrentUser('userId') adminId: string) {
    return this.usersService.create(dto, adminId);
  }

  @Get()
  @Roles('super_admin', 'admin', 'branch_manager')
  findAll(@Query('branchId') branchId?: string) {
    return this.usersService.findAll(branchId);
  }

  @Get(':userId')
  @Roles('super_admin', 'admin', 'branch_manager')
  findOne(@Param('userId') userId: string) {
    return this.usersService.findOne(userId);
  }

  @Patch(':userId')
  @Roles('super_admin', 'admin')
  update(
    @Param('userId') userId: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser('userId') adminId: string,
  ) {
    return this.usersService.update(userId, dto, adminId);
  }

  @Post(':userId/unlock')
  @Roles('super_admin', 'admin')
  unlock(@Param('userId') userId: string, @CurrentUser('userId') adminId: string) {
    return this.usersService.unlock(userId, adminId);
  }

  @Post(':userId/reset-password')
  @Roles('super_admin', 'admin')
  resetPassword(
    @Param('userId') userId: string,
    @Body('newPassword') newPassword: string,
    @CurrentUser('userId') adminId: string,
  ) {
    return this.usersService.resetPassword(userId, newPassword, adminId);
  }
}
