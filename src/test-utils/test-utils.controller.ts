import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Rotas de utilidade disponíveis APENAS em ambiente de desenvolvimento.
 * Permitem que testes E2E obtenham tokens de verificação sem depender de e-mail.
 * NÃO existe em produção.
 */
@ApiTags('Test Utils (dev only)')
@Controller('test-utils')
export class TestUtilsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('company-token/:id')
  @ApiOperation({ summary: '[DEV] Retorna token de verificação de e-mail da empresa' })
  async getCompanyToken(@Param('id', ParseUUIDPipe) id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      select: { emailVerificationToken: true },
    });
    return { token: company?.emailVerificationToken ?? null };
  }

  @Get('employee-token/:id')
  @ApiOperation({ summary: '[DEV] Retorna token de verificação de e-mail do funcionário' })
  async getEmployeeToken(@Param('id', ParseUUIDPipe) id: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
      select: { emailVerificationToken: true },
    });
    return { token: employee?.emailVerificationToken ?? null };
  }
}
