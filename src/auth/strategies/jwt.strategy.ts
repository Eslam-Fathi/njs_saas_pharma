import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

interface JwtPayload {
  sub: string;
  tenant_id: string;
  role: string;
  branch_id: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('JWT_SECRET') || 'fallback_secret_key_123',
    });
  }

  validate(payload: JwtPayload) {
    return {
      userId: payload.sub,
      tenantId: payload.tenant_id,
      role: payload.role,
      branchId: payload.branch_id,
    };
  }
}
