import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export interface JwtPayload {
  sub: string;
  username: string;
  role: string;
  branchId: string;
  mfaVerified: boolean;
  customerId?: string;
  type?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    @InjectDataSource() private ds: DataSource,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    if (payload.type === 'refresh') throw new UnauthorizedException('Use access token');

    const [user] = await this.ds.query(
      `SELECT user_id, status, role FROM users WHERE user_id = $1 LIMIT 1`,
      [payload.sub]
    );

    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('User account is inactive or not found');
    }

    return {
      userId:      payload.sub,
      username:    payload.username,
      role:        payload.role,
      branchId:    payload.branchId,
      mfaVerified: payload.mfaVerified,
      customerId:  payload.customerId,
    };
  }
}
