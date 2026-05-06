import {
  Injectable,
  ConflictException,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { AttendanceStatus } from '@prisma/client';

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notification: NotificationService,
  ) {}

  // ─── Check-in ────────────────────────────────────────────────────────────────

  async checkIn(employeeId: string) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Busca funcionário com dados da empresa
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, isActive: true, deletedAt: null },
      include: {
        company: {
          select: { id: true, allowOvertime: true },
        },
      },
    });

    if (!employee) throw new NotFoundException('Funcionário não encontrado');
    if (!employee.emailVerified) {
      throw new ForbiddenException('E-mail não verificado');
    }

    // Verifica se já fez check-in hoje
    const existing = await this.prisma.attendanceRecord.findUnique({
      where: { employeeId_date: { employeeId, date: today } },
    });

    if (existing?.checkIn) {
      throw new ConflictException('Check-in já realizado hoje');
    }

    // Calcula minutos de atraso
    const [entryHour, entryMinute] = employee.entryTime.split(':').map(Number);
    const scheduledEntry = new Date(today);
    scheduledEntry.setHours(entryHour, entryMinute, 0, 0);

    const minutesLate = Math.max(
      0,
      Math.floor((now.getTime() - scheduledEntry.getTime()) / 60_000),
    );

    const status: AttendanceStatus =
      minutesLate === 0 ? AttendanceStatus.ON_TIME : AttendanceStatus.LATE;

    // Cria ou atualiza o registro (pode já existir como ABSENT do cron)
    const record = await this.prisma.attendanceRecord.upsert({
      where: { employeeId_date: { employeeId, date: today } },
      update: {
        checkIn: now,
        status,
        minutesLate,
      },
      create: {
        employeeId,
        companyId: employee.companyId,
        date: today,
        checkIn: now,
        status,
        minutesLate,
      },
    });

    return {
      message: 'Check-in registrado com sucesso',
      checkIn: record.checkIn,
      status: record.status,
      minutesLate: record.minutesLate,
      scheduledEntry: employee.entryTime,
    };
  }

  // ─── Check-out ───────────────────────────────────────────────────────────────

  async checkOut(employeeId: string) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, isActive: true, deletedAt: null },
      include: {
        company: {
          select: {
            id: true,
            allowOvertime: true,
            maxOvertimeHours: true,
          },
        },
      },
    });

    if (!employee) throw new NotFoundException('Funcionário não encontrado');

    // Verifica se fez check-in hoje
    const record = await this.prisma.attendanceRecord.findUnique({
      where: { employeeId_date: { employeeId, date: today } },
    });

    if (!record || !record.checkIn) {
      throw new BadRequestException(
        'Check-in não encontrado para hoje. Registre a entrada primeiro.',
      );
    }

    if (record.checkOut) {
      throw new ConflictException('Check-out já realizado hoje');
    }

    // Calcula minutos de hora extra
    const [exitHour, exitMinute] = employee.exitTime.split(':').map(Number);
    const scheduledExit = new Date(today);
    scheduledExit.setHours(exitHour, exitMinute, 0, 0);

    const overtimeMinutes = Math.max(
      0,
      Math.floor((now.getTime() - scheduledExit.getTime()) / 60_000),
    );

    // Determina status final
    let finalStatus: AttendanceStatus;
    if (overtimeMinutes > 0) {
      finalStatus = AttendanceStatus.OVERTIME;
    } else if (record.minutesLate > 0) {
      finalStatus = AttendanceStatus.LATE;
    } else {
      finalStatus = AttendanceStatus.ON_TIME;
    }

    const updated = await this.prisma.attendanceRecord.update({
      where: { employeeId_date: { employeeId, date: today } },
      data: {
        checkOut: now,
        status: finalStatus,
        overtimeMinutes,
      },
    });

    // Notificação de hora extra não permitida
    if (overtimeMinutes > 0) {
      const companyAllows = employee.company.allowOvertime;
      const employeeAllowed = employee.overtimeAllowed;

      if (!companyAllows || !employeeAllowed) {
        void this.notification.sendOvertimeAlert(
          employee.email,
          employee.name,
          employee.exitTime,
          employee.id,
        );
      }

      // Verifica limite de horas extras da empresa
      if (
        companyAllows &&
        employee.company.maxOvertimeHours !== null
      ) {
        const maxMinutes =
          Number(employee.company.maxOvertimeHours) * 60;
        if (overtimeMinutes > maxMinutes) {
          void this.notification.sendOvertimeAlert(
            employee.email,
            employee.name,
            employee.exitTime,
            employee.id,
          );
        }
      }
    }

    return {
      message: 'Check-out registrado com sucesso',
      checkIn: updated.checkIn,
      checkOut: updated.checkOut,
      status: updated.status,
      minutesLate: updated.minutesLate,
      overtimeMinutes: updated.overtimeMinutes,
      scheduledExit: employee.exitTime,
    };
  }

  // ─── Histórico do funcionário ─────────────────────────────────────────────────

  async myHistory(employeeId: string, page = 1, limit = 30) {
    const skip = (page - 1) * limit;

    const [records, total] = await this.prisma.$transaction([
      this.prisma.attendanceRecord.findMany({
        where: { employeeId },
        orderBy: { date: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          date: true,
          checkIn: true,
          checkOut: true,
          status: true,
          minutesLate: true,
          overtimeMinutes: true,
          createdAt: true,
        },
      }),
      this.prisma.attendanceRecord.count({ where: { employeeId } }),
    ]);

    return {
      data: records,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ─── Hoje (status do dia atual do funcionário) ────────────────────────────────

  async todayStatus(employeeId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, deletedAt: null },
      select: { entryTime: true, exitTime: true },
    });

    if (!employee) throw new NotFoundException('Funcionário não encontrado');

    const record = await this.prisma.attendanceRecord.findUnique({
      where: { employeeId_date: { employeeId, date: today } },
    });

    return {
      today: today.toISOString().split('T')[0],
      scheduledEntry: employee.entryTime,
      scheduledExit: employee.exitTime,
      checkIn: record?.checkIn ?? null,
      checkOut: record?.checkOut ?? null,
      status: record?.status ?? null,
      minutesLate: record?.minutesLate ?? 0,
      overtimeMinutes: record?.overtimeMinutes ?? 0,
    };
  }
}
