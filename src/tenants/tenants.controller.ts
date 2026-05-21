import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  Req,
  NotFoundException,
} from '@nestjs/common';
import {
  TenantsService,
  RegisterTenantResponse,
  TenantProfileResponse,
} from './tenants.service';
import { RegisterTenantDto } from './dto/register-tenant.dto';
import { Public } from '../common/decorators/public.decorator';

import { Request } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

interface AuthenticatedRequest extends Request {
  user: {
    tenantId: string;
    role: string;
    branchId: string;
    userId: string;
  };
}

@ApiTags('Tenants')
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Public()
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() dto: RegisterTenantDto,
  ): Promise<RegisterTenantResponse> {
    return this.tenantsService.register(dto);
  }

  @Get('me')
  async getMe(
    @Req() req: AuthenticatedRequest,
  ): Promise<TenantProfileResponse> {
    // req.user is populated by the JwtAuthGuard and contains tenantId, role, etc.
    const tenantId = req.user.tenantId;
    const tenantDetails = await this.tenantsService.findById(tenantId);
    if (!tenantDetails) {
      throw new NotFoundException('Tenant not found');
    }
    return tenantDetails;
  }
}
