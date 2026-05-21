/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unused-vars */
import { Injectable, NestMiddleware } from '@nestjs/common';

import { Request, Response, NextFunction } from 'express';
import { TenantContextService } from '../context/tenant-context.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TenantResolverMiddleware implements NestMiddleware {
  constructor(
    private readonly tenantContextService: TenantContextService,
    private readonly prisma: PrismaService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    let tenantId: string | undefined;
    let userId: string | undefined;
    let role: string | undefined;

    // 1. Resolve context from JWT token (if present in Authorization header)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const payloadPart = token.split('.')[1];
        if (payloadPart) {
          const decoded = JSON.parse(
            Buffer.from(payloadPart, 'base64').toString('utf8'),
          );
          tenantId = decoded.tenant_id;
          userId = decoded.sub;
          role = decoded.role;
        }
      } catch (e) {
        // Suppress decode error and let JwtAuthGuard handle token validation
      }
    }

    // 2. If no JWT context (e.g. login, tenant registration, or public check routes)
    // Resolve tenant using the subdomain or custom header or login payload
    if (!tenantId) {
      const tenantSlugHeader = req.headers['x-tenant-slug'] as string;
      const tenantSlugBody = req.body?.tenant_slug as string;
      const slug = tenantSlugHeader || tenantSlugBody;

      if (slug) {
        // Query the tenant by unique slug to resolve its ID.
        // We query the database directly.
        const tenant = await this.prisma.tenant.findUnique({
          where: { slug },
          select: { id: true },
        });
        if (tenant) {
          tenantId = tenant.id;
        }
      }
    }

    // 3. Bind context for the duration of this request lifecycle
    this.tenantContextService.run({ tenantId, userId, role }, () => {
      next();
    });
  }
}
