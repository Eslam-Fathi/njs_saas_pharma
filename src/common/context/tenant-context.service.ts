import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

export interface TenantContext {
  tenantId?: string;
  userId?: string;
  role?: string;
}

@Injectable()
export class TenantContextService {
  private readonly asyncLocalStorage = new AsyncLocalStorage<TenantContext>();

  run<T>(context: TenantContext, callback: () => T): T {
    return this.asyncLocalStorage.run(context, callback);
  }

  getStore(): TenantContext | undefined {
    return this.asyncLocalStorage.getStore();
  }

  getTenantId(): string | undefined {
    return this.getStore()?.tenantId;
  }

  getUserId(): string | undefined {
    return this.getStore()?.userId;
  }

  getRole(): string | undefined {
    return this.getStore()?.role;
  }
}
