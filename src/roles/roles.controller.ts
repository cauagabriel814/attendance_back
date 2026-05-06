import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { CompanyOnlyGuard } from '../auth/guards/company-only.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Cargos')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, CompanyOnlyGuard)
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  @ApiOperation({ summary: 'Criar cargo na empresa' })
  create(
    @CurrentUser('sub') companyId: string,
    @Body() dto: CreateRoleDto,
  ) {
    return this.rolesService.create(companyId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar cargos da empresa' })
  findAll(@CurrentUser('sub') companyId: string) {
    return this.rolesService.findAll(companyId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar cargo' })
  update(
    @CurrentUser('sub') companyId: string,
    @Param('id', ParseUUIDPipe) roleId: string,
    @Body() dto: Partial<CreateRoleDto>,
  ) {
    return this.rolesService.update(companyId, roleId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remover cargo (soft delete)' })
  @HttpCode(HttpStatus.OK)
  remove(
    @CurrentUser('sub') companyId: string,
    @Param('id', ParseUUIDPipe) roleId: string,
  ) {
    return this.rolesService.remove(companyId, roleId);
  }
}
