import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';

import { DashboardService } from './dashboard.service';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { CompanyOnlyGuard } from '../auth/guards/company-only.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, CompanyOnlyGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @ApiOperation({ summary: 'Métricas completas da empresa (somente admin)' })
  @ApiQuery({
    name: 'period',
    required: false,
    enum: ['today', 'week', 'month'],
    description: 'Período de referência (padrão: month)',
  })
  getMetrics(
    @CurrentUser('sub') companyId: string,
    @Query('period') period?: 'today' | 'week' | 'month',
  ) {
    return this.dashboardService.getMetrics(
      companyId,
      period ?? 'month',
    );
  }
}
