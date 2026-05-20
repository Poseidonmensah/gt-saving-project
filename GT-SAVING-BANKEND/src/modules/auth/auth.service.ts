import { Injectable, UnauthorizedException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { UserEntity } from '../users/entities/user.entity';
import { UserSessionEntity } from '../users/entities/user-session.entity';
import { AuditService } from '../audit/audit.service';
import { LoginDto, MfaVerifyDto, ChangePasswordDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
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
      relations: ['branch'] 
    });
    
    if (!user) throw new UnauthorizedException('Invalid credentials');
    
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) throw new UnauthorizedException('Invalid credentials');
    
    return user;
  }

  async login(dto: LoginDto, ip: string, ua: string) {
    const user = await this.validateUser(dto.username, dto.password);
    const payload = { sub: user.userId, username: user.username, role: user.role };
    
    return { 
      accessToken: this.jwtService.sign(payload), 
      user: {
        userId: user.userId,
        username: user.username,
        role: user.role,
        email: user.email
      } 
    };
  }

  async logout(userId: string, token: string) {
    return { message: 'Logged out' };
  }

  async setupMfa(userId: string) {
    return { message: 'MFA Setup initialized' };
  }

  async enableMfa(userId: string, dto: MfaVerifyDto) {
    return { message: 'MFA Enabled' };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    return { message: 'Password changed' };
  }
}