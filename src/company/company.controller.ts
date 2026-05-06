import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { CompanyService } from './company.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { LoginCompanyDto } from './dto/login-company.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { RefreshTokenGuard } from '../auth/guards/refresh-token.guard';
import { CompanyOnlyGuard } from '../auth/guards/company-only.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtRefreshPayload } from '../auth/strategies/refresh-token.strategy';

@ApiTags('Empresas')
@Controller('companies')
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @Post('register')
  @ApiOperation({ summary: 'Cadastrar nova empresa' })
  register(@Body() dto: CreateCompanyDto) {
    return this.companyService.register(dto);
  }

  @Post('verify-email')
  @ApiOperation({ summary: 'Verificar e-mail da empresa' })
  @HttpCode(HttpStatus.OK)
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.companyService.verifyEmail(dto.token);
  }

  @Post('login')
  @Throttle({ auth: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Login da empresa (admin)' })
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginCompanyDto) {
    return this.companyService.login(dto);
  }

  @Post('refresh')
  @UseGuards(RefreshTokenGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Renovar access token usando refresh token' })
  @HttpCode(HttpStatus.OK)
  refresh(@CurrentUser() user: JwtRefreshPayload) {
    return this.companyService.refresh(user.sub, user.refreshToken, user.email);
  }

  @Post('logout')
  @UseGuards(AccessTokenGuard, CompanyOnlyGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout da empresa' })
  @HttpCode(HttpStatus.OK)
  logout(@CurrentUser('sub') companyId: string) {
    return this.companyService.logout(companyId);
  }

  @Get('me')
  @UseGuards(AccessTokenGuard, CompanyOnlyGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Perfil da empresa autenticada' })
  getProfile(@CurrentUser('sub') companyId: string) {
    return this.companyService.getProfile(companyId);
  }
}
