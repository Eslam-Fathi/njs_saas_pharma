/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from './client';
import { TenantContextService } from '../common/context/tenant-context.service';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  // This is the extended client that services should use for queries.
  // Using an extended client ensures that tenant isolation is active.
  public readonly db;
  private readonly pool: Pool;

  constructor(private readonly tenantContextService: TenantContextService) {
    // 1. Initialize Pg Pool and Driver Adapter for Prisma 7
    const connectionString = process.env.DATABASE_URL;
    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);

    // 2. Pass the adapter to the super (PrismaClient) constructor
    super({ adapter });
    this.pool = pool;

    const tenantScopedModels = [
      'Subscription',
      'Branch',
      'User',
      'Category',
      'Manufacturer',
      'Drug',
      'Inventory',
      'InventoryBatch',
      'StockMovement',
      'Supplier',
      'PurchaseOrder',
      'GRN',
      'CashierSession',
      'Cart',
      'Transaction',
    ];

    this.db = this.$extends({
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            const anyArgs = args as any;

            // Check if this model is scoped to a tenant
            if (tenantScopedModels.includes(model)) {
              const tenantId = tenantContextService.getTenantId();
              const userRole = tenantContextService.getRole();
              const isSuperAdmin = userRole === 'SUPER_ADMIN';

              if (isSuperAdmin) {
                // Allow global operations for super admin without injecting tenant context
              } else if (tenantId) {
                // 1. Handle creation operations (inject tenant_id)
                if (operation === 'create') {
                  anyArgs.data = anyArgs.data || {};
                  anyArgs.data.tenant_id = tenantId;
                } else if (operation === 'createMany') {
                  if (Array.isArray(anyArgs.data)) {
                    anyArgs.data = anyArgs.data.map((item: any) => ({
                      ...item,
                      tenant_id: tenantId,
                    }));
                  } else if (anyArgs.data) {
                    anyArgs.data.tenant_id = tenantId;
                  }
                }

                // 2. Handle unique lookups (which Prisma restricts to unique index columns in 'where')
                // Convert findUnique to findFirst to allow filtering by the tenant_id field.
                if (
                  operation === 'findUnique' ||
                  operation === 'findUniqueOrThrow'
                ) {
                  const newOperation =
                    operation === 'findUnique'
                      ? 'findFirst'
                      : 'findFirstOrThrow';
                  anyArgs.where = anyArgs.where || {};
                  anyArgs.where.tenant_id = tenantId;

                  // Execute via the base unextended client to avoid circular operations and reuse connection pool
                  return this[model][newOperation](anyArgs);
                }

                // 3. Handle upsert operations
                if (operation === 'upsert') {
                  anyArgs.create = anyArgs.create || {};
                  anyArgs.create.tenant_id = tenantId;
                  anyArgs.update = anyArgs.update || {};
                  anyArgs.update.tenant_id = tenantId;
                  anyArgs.where = anyArgs.where || {};
                  anyArgs.where.tenant_id = tenantId;
                }

                // 4. Handle standard read, update, delete operations
                const filterOperations = [
                  'findFirst',
                  'findFirstOrThrow',
                  'findMany',
                  'update',
                  'updateMany',
                  'delete',
                  'deleteMany',
                  'count',
                  'aggregate',
                  'groupBy',
                ];

                if (filterOperations.includes(operation)) {
                  anyArgs.where = anyArgs.where || {};
                  anyArgs.where.tenant_id = tenantId;
                }
              } else {
                throw new Error(
                  `Security Violation: Attempted to access tenant-scoped model '${model}' without a valid tenant context.`,
                );
              }
            }

            return query(anyArgs);
          },
        },
      },
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end();
  }
}
