import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { AttendanceStatus } from '@prisma/client';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const todayAt = (hour: number, minute: number) => {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d;
};

const padT = (n: number) => String(n).padStart(2, '0');
const hm = (h: number, m: number) => `${padT(h)}:${padT(m)}`;

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockPrisma = {
  employee: {
    findFirst: jest.fn(),
  },
  attendanceRecord: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockNotification = {
  sendOvertimeAlert: jest.fn(),
};

// ─── Testes ───────────────────────────────────────────────────────────────────

describe('AttendanceService', () => {
  let service: AttendanceService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationService, useValue: mockNotification },
      ],
    }).compile();

    service = module.get<AttendanceService>(AttendanceService);
  });

  // ─── checkIn ──────────────────────────────────────────────────────────────

  describe('checkIn', () => {
    const now = new Date();
    const nowH = now.getHours();
    const nowM = now.getMinutes();

    const mockEmployee = {
      id: 'emp-uuid',
      companyId: 'comp-uuid',
      entryTime: hm(nowH, nowM), // horário de entrada = agora
      emailVerified: true,
      company: { id: 'comp-uuid', allowOvertime: false },
    };

    it('deve lançar NotFoundException se funcionário não existe', async () => {
      mockPrisma.employee.findFirst.mockResolvedValueOnce(null);
      await expect(service.checkIn('invalid-id')).rejects.toThrow(NotFoundException);
    });

    it('deve lançar ForbiddenException se e-mail não verificado', async () => {
      mockPrisma.employee.findFirst.mockResolvedValueOnce({
        ...mockEmployee,
        emailVerified: false,
      });
      await expect(service.checkIn('emp-uuid')).rejects.toThrow(ForbiddenException);
    });

    it('deve lançar ConflictException se check-in já realizado', async () => {
      mockPrisma.employee.findFirst.mockResolvedValueOnce(mockEmployee);
      mockPrisma.attendanceRecord.findUnique.mockResolvedValueOnce({
        checkIn: new Date(),
      });
      await expect(service.checkIn('emp-uuid')).rejects.toThrow(ConflictException);
    });

    it('deve registrar check-in com status ON_TIME quando no horário', async () => {
      mockPrisma.employee.findFirst.mockResolvedValueOnce(mockEmployee);
      mockPrisma.attendanceRecord.findUnique.mockResolvedValueOnce(null);
      mockPrisma.attendanceRecord.upsert.mockResolvedValueOnce({
        checkIn: new Date(),
        status: AttendanceStatus.ON_TIME,
        minutesLate: 0,
      });

      const result = await service.checkIn('emp-uuid');
      expect(result.status).toBe(AttendanceStatus.ON_TIME);
      expect(result.minutesLate).toBe(0);
    });

    it('deve registrar check-in com status LATE quando atrasado', async () => {
      // Funcionário com horário de entrada 1h atrás
      const pastH = nowH === 0 ? 23 : nowH - 1;
      mockPrisma.employee.findFirst.mockResolvedValueOnce({
        ...mockEmployee,
        entryTime: hm(pastH, nowM),
      });
      mockPrisma.attendanceRecord.findUnique.mockResolvedValueOnce(null);
      mockPrisma.attendanceRecord.upsert.mockResolvedValueOnce({
        checkIn: new Date(),
        status: AttendanceStatus.LATE,
        minutesLate: 60,
      });

      const result = await service.checkIn('emp-uuid');
      expect(result.status).toBe(AttendanceStatus.LATE);
    });
  });

  // ─── checkOut ─────────────────────────────────────────────────────────────

  describe('checkOut', () => {
    const now = new Date();
    const exitH = now.getHours() > 0 ? now.getHours() - 1 : 0;
    const exitM = now.getMinutes();

    const mockEmployee = {
      id: 'emp-uuid',
      companyId: 'comp-uuid',
      exitTime: hm(exitH, exitM), // saída 1h atrás = horas extras
      emailVerified: true,
      overtimeAllowed: false,
      company: { id: 'comp-uuid', allowOvertime: false, maxOvertimeHours: null },
    };

    it('deve lançar NotFoundException se funcionário não existe', async () => {
      mockPrisma.employee.findFirst.mockResolvedValueOnce(null);
      await expect(service.checkOut('invalid-id')).rejects.toThrow(NotFoundException);
    });

    it('deve lançar BadRequestException se não há check-in', async () => {
      mockPrisma.employee.findFirst.mockResolvedValueOnce(mockEmployee);
      mockPrisma.attendanceRecord.findUnique.mockResolvedValueOnce(null);
      await expect(service.checkOut('emp-uuid')).rejects.toThrow(BadRequestException);
    });

    it('deve lançar ConflictException se check-out já realizado', async () => {
      mockPrisma.employee.findFirst.mockResolvedValueOnce(mockEmployee);
      mockPrisma.attendanceRecord.findUnique.mockResolvedValueOnce({
        checkIn: new Date(),
        checkOut: new Date(),
      });
      await expect(service.checkOut('emp-uuid')).rejects.toThrow(ConflictException);
    });

    it('deve enviar alerta de hora extra quando empresa não permite', async () => {
      mockPrisma.employee.findFirst.mockResolvedValueOnce(mockEmployee);
      mockPrisma.attendanceRecord.findUnique.mockResolvedValueOnce({
        checkIn: new Date(),
        checkOut: null,
        minutesLate: 0,
      });
      mockPrisma.attendanceRecord.update.mockResolvedValueOnce({
        checkIn: new Date(),
        checkOut: new Date(),
        status: AttendanceStatus.OVERTIME,
        minutesLate: 0,
        overtimeMinutes: 60,
      });

      await service.checkOut('emp-uuid');
      // notificação de hora extra deve ser disparada
      expect(mockNotification.sendOvertimeAlert).toHaveBeenCalled();
    });
  });

  // ─── myHistory ────────────────────────────────────────────────────────────

  describe('myHistory', () => {
    it('deve retornar histórico paginado', async () => {
      const mockRecords = [{ id: 'r1', date: new Date(), status: AttendanceStatus.ON_TIME }];
      mockPrisma.$transaction.mockResolvedValueOnce([mockRecords, 1]);

      const result = await service.myHistory('emp-uuid', 1, 30);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.totalPages).toBe(1);
    });
  });
});
