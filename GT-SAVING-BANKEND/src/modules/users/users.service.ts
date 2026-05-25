import { Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  async findOne(id: string) {
    return { userId: id, username: 'admin' };
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  async comparePassword(provided: string, hash: string): Promise<boolean> {
    return bcrypt.compare(provided, hash);
  }
}