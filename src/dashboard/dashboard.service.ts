import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceStatus } from '@prisma/client';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getMetrics(companyId: string, period: 'week' | 'month' | 'today' = 'month') {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // ─── Período de referência ───────────────────────────────────────────────
    let periodStart: Date;
    if (period === 'today') {
      periodStart = todayStart;
    } else if (period === 'week') {
      periodStart = new Date(todayStart);
      periodStart.setDate(todayStart.getDate() - 6);
    } else {
      // month
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    // ─── Total de funcionários ativos + limite de hora extra da empresa ───────
    const [totalActiveEmployees, company] = await Promise.all([
      this.prisma.employee.count({
        where: { companyId, isActive: true, deletedAt: null },
      }),
      this.prisma.company.findUnique({
        where: { id: companyId },
        select: { maxOvertimeHours: true },
      }),
    ]);

    const maxOvertimeHours = company?.maxOvertimeHours
      ? Number(company.maxOvertimeHours)
      : null;

    // ─── Métricas do dia atual ───────────────────────────────────────────────
    const todayRecords = await this.prisma.attendanceRecord.findMany({
      where: { companyId, date: todayStart },
      select: { status: true, minutesLate: true, overtimeMinutes: true, employeeId: true },
    });

    const presentToday = todayRecords.filter(
      (r) => r.status !== AttendanceStatus.ABSENT,
    ).length;

    const absentToday = todayRecords.filter(
      (r) => r.status === AttendanceStatus.ABSENT,
    ).length;

    // Funcionários sem registro hoje ainda (não chegaram nem foram marcados como ausentes)
    const notYetRegistered = totalActiveEmployees - todayRecords.length;
    const totalAbsentToday = absentToday + notYetRegistered;

    const onTimeToday = todayRecords.filter(
      (r) => r.status === AttendanceStatus.ON_TIME,
    ).length;

    const lateToday = todayRecords.filter(
      (r) => r.status === AttendanceStatus.LATE,
    ).length;

    const overtimeToday = todayRecords.filter(
      (r) => r.status === AttendanceStatus.OVERTIME,
    ).length;

    // ─── Métricas do período ─────────────────────────────────────────────────
    const periodRecords = await this.prisma.attendanceRecord.findMany({
      where: {
        companyId,
        date: { gte: periodStart, lte: todayStart },
      },
      select: {
        employeeId: true,
        status: true,
        minutesLate: true,
        overtimeMinutes: true,
        date: true,
        employee: { select: { id: true, name: true, email: true } },
      },
    });

    // Total de horas extras no período (em minutos → horas)
    const totalOvertimeMinutes = periodRecords.reduce(
      (acc, r) => acc + r.overtimeMinutes,
      0,
    );
    const totalOvertimeHours = +(totalOvertimeMinutes / 60).toFixed(2);

    // ─── Ranking de pontualidade (top 5 mais pontuais) ───────────────────────
    const employeeStats = this.aggregateByEmployee(periodRecords);

    const punctualityRanking = Object.values(employeeStats)
      .map((s) => ({
        employeeId: s.employeeId,
        name: s.name,
        onTimeCount: s.onTimeCount,
        totalDays: s.totalDays,
        punctualityRate:
          s.totalDays > 0
            ? +((s.onTimeCount / s.totalDays) * 100).toFixed(1)
            : 0,
      }))
      .sort((a, b) => b.punctualityRate - a.punctualityRate)
      .slice(0, 5);

    // ─── Ranking de atrasos (top 5 mais atrasados) ───────────────────────────
    const lateRanking = Object.values(employeeStats)
      .filter((s) => s.totalLateMinutes > 0)
      .map((s) => ({
        employeeId: s.employeeId,
        name: s.name,
        lateCount: s.lateCount,
        totalLateMinutes: s.totalLateMinutes,
        avgLateMinutes:
          s.lateCount > 0
            ? +(s.totalLateMinutes / s.lateCount).toFixed(1)
            : 0,
      }))
      .sort((a, b) => b.totalLateMinutes - a.totalLateMinutes)
      .slice(0, 5);

    // ─── Horas extras por funcionário no período ─────────────────────────────
    const overtimeByEmployee = Object.values(employeeStats)
      .filter((s) => s.totalOvertimeMinutes > 0)
      .map((s) => ({
        employeeId: s.employeeId,
        name: s.name,
        overtimeMinutes: s.totalOvertimeMinutes,
        overtimeHours: +(s.totalOvertimeMinutes / 60).toFixed(2),
      }))
      .sort((a, b) => b.overtimeMinutes - a.overtimeMinutes);

    // ─── Média de minutos de atraso (todos os funcionários) ──────────────────
    const allLateMinutes = periodRecords
      .filter((r) => r.status === AttendanceStatus.LATE)
      .map((r) => r.minutesLate);

    const avgLateMinutes =
      allLateMinutes.length > 0
        ? +(
            allLateMinutes.reduce((a, b) => a + b, 0) / allLateMinutes.length
          ).toFixed(1)
        : 0;

    // ─── Presença diária no período (para gráfico de barras) ─────────────────
    const dailyTrend = this.buildDailyTrend(periodRecords, periodStart, todayStart);

    // ─── Relatório de conformidade de jornada ────────────────────────────────
    const complianceReport = {
      maxOvertimeHours,
      employees: overtimeByEmployee.map((emp) => ({
        employeeId:    emp.employeeId,
        name:          emp.name,
        overtimeHours: emp.overtimeHours,
        exceeded:
          maxOvertimeHours !== null ? emp.overtimeHours > maxOvertimeHours : false,
      })),
    };

    return {
      period,
      periodStart: periodStart.toISOString().split('T')[0],
      periodEnd: todayStart.toISOString().split('T')[0],
      summary: {
        totalActiveEmployees,
        presentToday,
        absentToday: totalAbsentToday,
        onTimeToday,
        lateToday,
        overtimeToday,
        totalOvertimeHours,
        avgLateMinutes,
      },
      rankings: {
        mostPunctual: punctualityRanking,
        mostLate: lateRanking,
      },
      overtimeByEmployee,
      complianceReport,
      dailyTrend,
    };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private aggregateByEmployee(records: Array<{
    employeeId: string;
    status: AttendanceStatus;
    minutesLate: number;
    overtimeMinutes: number;
    employee: { id: string; name: string; email: string };
  }>) {
    const map: Record<string, {
      employeeId: string;
      name: string;
      totalDays: number;
      onTimeCount: number;
      lateCount: number;
      totalLateMinutes: number;
      totalOvertimeMinutes: number;
    }> = {};

    for (const r of records) {
      if (!map[r.employeeId]) {
        map[r.employeeId] = {
          employeeId: r.employeeId,
          name: r.employee.name,
          totalDays: 0,
          onTimeCount: 0,
          lateCount: 0,
          totalLateMinutes: 0,
          totalOvertimeMinutes: 0,
        };
      }
      const s = map[r.employeeId];
      s.totalDays++;
      if (r.status === AttendanceStatus.ON_TIME) s.onTimeCount++;
      if (r.status === AttendanceStatus.LATE || r.minutesLate > 0) {
        s.lateCount++;
        s.totalLateMinutes += r.minutesLate;
      }
      s.totalOvertimeMinutes += r.overtimeMinutes;
    }

    return map;
  }

  private buildDailyTrend(
    records: Array<{
      date: Date;
      status: AttendanceStatus;
      employeeId: string;
    }>,
    from: Date,
    to: Date,
  ) {
    // Cria mapa date → { present, absent, late, onTime }
    const map: Record<string, { date: string; present: number; absent: number; late: number; onTime: number; overtime: number }> = {};

    const cur = new Date(from);
    while (cur <= to) {
      const key = cur.toISOString().split('T')[0];
      map[key] = { date: key, present: 0, absent: 0, late: 0, onTime: 0, overtime: 0 };
      cur.setDate(cur.getDate() + 1);
    }

    for (const r of records) {
      const key = new Date(r.date).toISOString().split('T')[0];
      if (!map[key]) continue;
      if (r.status === AttendanceStatus.ABSENT) {
        map[key].absent++;
      } else {
        map[key].present++;
        if (r.status === AttendanceStatus.LATE) map[key].late++;
        if (r.status === AttendanceStatus.ON_TIME) map[key].onTime++;
        if (r.status === AttendanceStatus.OVERTIME) map[key].overtime++;
      }
    }

    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  }
}
