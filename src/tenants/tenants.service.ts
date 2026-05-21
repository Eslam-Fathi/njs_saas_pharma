/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterTenantDto } from './dto/register-tenant.dto';
import * as bcrypt from 'bcrypt';

export interface RegisterTenantResponse {
  tenant_id: string;
  business_name: string;
  slug: string;
  trial_ends_at: Date | null;
  user: {
    id: string;
    name: string;
    username: string;
    role: string;
    branch_id: string | null;
  };
}

export interface TenantProfileResponse {
  id: string;
  business_name: string;
  slug: string;
  is_active: boolean;
  created_at: Date;
  subscription: {
    plan: string;
    status: string;
    trial_ends_at: Date | null;
    current_period_end: Date | null;
    limits: {
      max_branches: number | 'Unlimited';
      max_users: number | 'Unlimited';
      max_drugs: number | 'Unlimited';
      current_branches: number;
      current_users: number;
      current_drugs: number;
    };
  } | null;
}

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async register(dto: RegisterTenantDto): Promise<RegisterTenantResponse> {
    // 1. Verify that the requested tenant slug is unique
    const existingTenant = await this.prisma.tenant.findUnique({
      where: { slug: dto.tenant_slug },
    });
    if (existingTenant) {
      throw new ConflictException('Tenant slug is already taken');
    }

    // 2. Hash the owner's password
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // 3. Atomically create all tenant resources within a transaction
    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          business_name: dto.business_name,
          slug: dto.tenant_slug,
        },
      });

      const branch = await tx.branch.create({
        data: {
          tenant_id: tenant.id,
          name: 'Main Branch',
        },
      });

      const user = await tx.user.create({
        data: {
          tenant_id: tenant.id,
          name: dto.owner_name,
          username: dto.username,
          password: hashedPassword,
          role: 'TENANT_OWNER',
          branch_id: branch.id,
        },
      });

      const subscription = await tx.subscription.create({
        data: {
          tenant_id: tenant.id,
          plan: 'STARTER',
          status: 'TRIAL',
          trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days trial
        },
      });

      return {
        tenant_id: tenant.id,
        business_name: tenant.business_name,
        slug: tenant.slug,
        trial_ends_at: subscription.trial_ends_at,
        user: {
          id: user.id,
          name: user.name,
          username: user.username,
          role: user.role,
          branch_id: user.branch_id,
        },
      };
    });
  }

  async findBySlug(slug: string) {
    return this.prisma.tenant.findUnique({
      where: { slug },
      include: { subscription: true },
    });
  }

  async findById(id: string): Promise<TenantProfileResponse | null> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: { subscription: true },
    });

    if (!tenant) return null;

    // Count entities using the tenant-scoped client
    const [branchCount, userCount, drugCount] = await Promise.all([
      this.prisma.db.branch.count(),
      this.prisma.db.user.count(),
      this.prisma.db.drug.count(),
    ]);

    const planLimits = {
      STARTER: { max_branches: 1, max_users: 5, max_drugs: 500 },
      PRO: { max_branches: 5, max_users: 25, max_drugs: 5000 },
      ENTERPRISE: {
        max_branches: Infinity,
        max_users: Infinity,
        max_drugs: Infinity,
      },
    };

    const plan = tenant.subscription?.plan || 'STARTER';
    const limits = planLimits[plan];

    return {
      id: tenant.id,
      business_name: tenant.business_name,
      slug: tenant.slug,
      is_active: tenant.is_active,
      created_at: tenant.created_at,
      subscription: tenant.subscription
        ? {
            plan: tenant.subscription.plan,
            status: tenant.subscription.status,
            trial_ends_at: tenant.subscription.trial_ends_at,
            current_period_end: tenant.subscription.current_period_end,
            limits: {
              max_branches:
                limits.max_branches === Infinity
                  ? 'Unlimited'
                  : limits.max_branches,
              max_users:
                limits.max_users === Infinity ? 'Unlimited' : limits.max_users,
              max_drugs:
                limits.max_drugs === Infinity ? 'Unlimited' : limits.max_drugs,
              current_branches: branchCount,
              current_users: userCount,
              current_drugs: drugCount,
            },
          }
        : null,
    };
  }
}
