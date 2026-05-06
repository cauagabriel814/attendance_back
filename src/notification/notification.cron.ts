import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from './notification.service';

@Injectable()
export class NotificationCronService {
  private readonly logger = new Logger(NotificationCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notification: NotificationService,
  ) {}

  /**
   * Roda a cada minuto e verifica quais funcionários têm horário de entrada
   * daqui a 10 minutos exatos para enviar o lembrete.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleCheckInReminders() {
    const now = new Date();
    const targetTime = new Date(now.getTime() + 10 * 60 * 1000);
    const timeStr = `${String(targetTime.getHours()).padStart(2, '0')}:${String(targetTime.getMinutes()).padStart(2, '0')}`;

    const employees = await this.prisma.employee.findMany({
      where: {
        entryTime: timeStr,
        isActive: true,
        emailVerified: true,
        deletedAt: null,
      },
    });

    for (const emp of employees) {
      await this.notification.sendCheckInReminder(emp.email, emp.name, emp.entryTime, emp.id);
    }

    if (employees.length > 0) {
      this.logger.log(`Lembretes de entrada enviados para ${employees.length} funcionário(s) às ${timeStr}`);
    }
  }

  /**
   * Roda a cada minuto e verifica quais funcionários têm horário de saída
   * daqui a 10 minutos para enviar o lembrete.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleCheckOutReminders() {
    const now = new Date();
    const targetTime = new Date(now.getTime() + 10 * 60 * 1000);
    const timeStr = `${String(targetTime.getHours()).padStart(2, '0')}:${String(targetTime.getMinutes()).padStart(2, '0')}`;

    const employees = await this.prisma.employee.findMany({
      where: {
        exitTime: timeStr,
        isActive: true,
        emailVerified: true,
        deletedAt: null,
      },
    });

    for (const emp of employees) {
      await this.notification.sendCheckOutReminder(emp.email, emp.name, emp.exitTime, emp.id);
    }

    if (employees.length > 0) {
      this.logger.log(`Lembretes de saída enviados para ${employees.length} funcionário(s) às ${timeStr}`);
    }
  }

  /**
   * Roda às 23:59 todos os dias para marcar como ABSENT
   * todos os funcionários que não fizeram check-in no dia.
   */
  @Cron('59 23 * * *')
  async handleMarkAbsences() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const employees = await this.prisma.employee.findMany({
      where: { isActive: true, deletedAt: null, emailVerified: true },
      select: { id: true, companyId: true },
    });

    let absences = 0;
    for (const emp of employees) {
      const existing = await this.prisma.attendanceRecord.findUnique({
        where: { employeeId_date: { employeeId: emp.id, date: today } },
      });

      if (!existing) {
        await this.prisma.attendanceRecord.create({
          data: {
            employeeId: emp.id,
            companyId: emp.companyId,
            date: today,
            status: 'ABSENT',
          },
        });
        absences++;
      }
    }

    if (absences > 0) {
      this.logger.log(`${absences} ausência(s) registradas automaticamente`);
    }
  }
}
