import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto) {
    // 1. Resolve tenant by slug using unextended client (public access)
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: dto.tenant_slug },
      include: { subscription: true },
    });

    if (!tenant) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!tenant.is_active) {
      throw new ForbiddenException('Tenant business account is suspended');
    }

    // 2. Fetch user scoped to that tenant
    const user = await this.prisma.user.findUnique({
      where: {
        tenant_id_username: {
          tenant_id: tenant.id,
          username: dto.username,
        },
      },
    });

    if (!user || !user.is_active) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // 3. Verify password
    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // 4. Generate JWT payload containing the tenant context
    const payload = {
      sub: user.id,
      tenant_id: tenant.id,
      role: user.role,
      branch_id: user.branch_id,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        branch_id: user.branch_id,
        tenant_id: tenant.id,
      },
    };
  }
}
