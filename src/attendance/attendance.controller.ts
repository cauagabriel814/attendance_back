import {
  Controller,
  Get,
  Post,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';

import { AttendanceService } from './attendance.service';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Ponto')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('check-in')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Registrar entrada (check-in)' })
  checkIn(@CurrentUser('sub') employeeId: string) {
    return this.attendanceService.checkIn(employeeId);
  }

  @Post('check-out')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Registrar saída (check-out)' })
  checkOut(@CurrentUser('sub') employeeId: string) {
    return this.attendanceService.checkOut(employeeId);
  }

  @Get('today')
  @ApiOperation({ summary: 'Status do ponto de hoje do funcionário' })
  todayStatus(@CurrentUser('sub') employeeId: string) {
    return this.attendanceService.todayStatus(employeeId);
  }

  @Get('my-history')
  @ApiOperation({ summary: 'Histórico de ponto do funcionário autenticado' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  myHistory(
    @CurrentUser('sub') employeeId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.attendanceService.myHistory(
      employeeId,
      page ? Number(page) : 1,
      limit ? Number(limit) : 30,
    );
  }

  @Get('monthly-summary')
  @ApiOperation({ summary: 'Resumo mensal de horas do funcionário autenticado' })
  monthlySummary(@CurrentUser('sub') employeeId: string) {
    return this.attendanceService.monthlySummary(employeeId);
  }
}
