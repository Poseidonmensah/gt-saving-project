import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { UserEntity } from '../users/entities/user.entity';
import { UserSessionEntity } from '../users/entities/user-session.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity) private usersRepo: Repository<UserEntity>,
    @InjectRepository(UserSessionEntity) private sessionsRepo: Repository<UserSessionEntity>,
    private jwtService: JwtService,
  ) {}

  async validateUser(username: string, password: string): Promise<any> {
    const user = await this.usersRepo.findOne({ where: [{ username }, { email: username }] });
    if (user && await bcrypt.compare(password, user.passwordHash)) {
      const { passwordHash, ...result } = user;
      return result;
    }
    throw new UnauthorizedException();
  }

  async login(user: any) {
    const payload = { sub: user.userId, username: user.username, role: user.role };
    return { accessToken: this.jwtService.sign(payload), user };
  }
  
  async logout(id: string, token: string) { return { message: 'success' }; }
  async setupMfa(id: string) { return { message: 'setup' }; }
  async enableMfa(id: string, dto: any) { return { message: 'enabled' }; }
  async changePassword(id: string, dto: any) { return { message: 'changed' }; }
}