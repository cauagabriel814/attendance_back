import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { EmployeeService } from './employee.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { LoginCompanyDto } from '../company/dto/login-company.dto';
import { VerifyEmailDto } from '../company/dto/verify-email.dto';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { RefreshTokenGuard } from '../auth/guards/refresh-token.guard';
import { CompanyOnlyGuard } from '../auth/guards/company-only.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/access-token.strategy';
import type { JwtRefreshPayload } from '../auth/strategies/refresh-token.strategy';

@ApiTags('Funcionários')
@Controller('employees')
export class EmployeeController {
  constructor(private readonly employeeService: EmployeeService) {}

  // ─── Rotas de Admin (empresa) ───────────────────────────────────────

  @Post()
  @UseGuards(AccessTokenGuard, CompanyOnlyGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cadastrar funcionário (somente admin)' })
  create(
    @CurrentUser('sub') companyId: string,
    @Body() dto: CreateEmployeeDto,
  ) {
    return this.employeeService.create(companyId, dto);
  }

  @Get()
  @UseGuards(AccessTokenGuard, CompanyOnlyGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar funcionários da empresa (admin)' })
  findAll(@CurrentUser('sub') companyId: string) {
    return this.employeeService.findAll(companyId);
  }

  @Delete(':id')
  @UseGuards(AccessTokenGuard, CompanyOnlyGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Desativar funcionário (soft delete)' })
  @HttpCode(HttpStatus.OK)
  remove(
    @CurrentUser('sub') companyId: string,
    @Param('id', ParseUUIDPipe) employeeId: string,
  ) {
    return this.employeeService.softDelete(companyId, employeeId);
  }

  // ─── Rotas públicas (autenticação de funcionário) ──────────────────

  @Post('verify-email')
  @ApiOperation({ summary: 'Verificar e-mail do funcionário' })
  @HttpCode(HttpStatus.OK)
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.employeeService.verifyEmail(dto.token);
  }

  @Post('login')
  @Throttle({ auth: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Login do funcionário' })
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginCompanyDto) {
    return this.employeeService.login(dto.email, dto.password);
  }

  @Post('refresh')
  @UseGuards(RefreshTokenGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Renovar access token do funcionário' })
  @HttpCode(HttpStatus.OK)
  refresh(@CurrentUser() user: JwtRefreshPayload) {
    return this.employeeService.refresh(user.sub, user.refreshToken, user.email);
  }

  @Post('logout')
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout do funcionário' })
  @HttpCode(HttpStatus.OK)
  logout(@CurrentUser('sub') employeeId: string) {
    return this.employeeService.logout(employeeId);
  }

  // ─── Perfil ────────────────────────────────────────────────────────

  @Get(':id')
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Perfil do funcionário (CPF descriptografado apenas para si mesmo)' })
  getProfile(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) targetId: string,
  ) {
    return this.employeeService.getProfile(user.sub, targetId, user.type);
  }
}
