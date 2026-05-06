import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { RolesService } from './roles.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  role: {
    findFirst: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  employee: {
    count: jest.fn(),
  },
};

describe('RolesService', () => {
  let service: RolesService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<RolesService>(RolesService);
  });

  // ─── create ───────────────────────────────────────────────────────────────

  describe('create', () => {
    it('deve lançar ConflictException se cargo já existe na empresa', async () => {
      mockPrisma.role.findFirst.mockResolvedValueOnce({ id: 'role-id', name: 'Dev' });
      await expect(
        service.create('comp-id', { name: 'Dev', permissions: [] }),
      ).rejects.toThrow(ConflictException);
    });

    it('deve criar cargo com sucesso', async () => {
      mockPrisma.role.findFirst.mockResolvedValueOnce(null);
      mockPrisma.role.create.mockResolvedValueOnce({
        id: 'role-uuid',
        name: 'Dev',
        permissions: [],
        createdAt: new Date(),
      });

      const result = await service.create('comp-id', { name: 'Dev', permissions: [] });
      expect(result).toHaveProperty('id', 'role-uuid');
    });
  });

  // ─── remove ───────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('deve lançar NotFoundException para cargo inexistente', async () => {
      mockPrisma.role.findFirst.mockResolvedValueOnce(null);
      await expect(service.remove('comp-id', 'role-id')).rejects.toThrow(NotFoundException);
    });

    it('deve lançar ForbiddenException se houver funcionários no cargo', async () => {
      mockPrisma.role.findFirst.mockResolvedValueOnce({ id: 'role-id', name: 'Dev' });
      mockPrisma.employee.count.mockResolvedValueOnce(3);
      await expect(service.remove('comp-id', 'role-id')).rejects.toThrow(ForbiddenException);
    });

    it('deve remover (soft delete) cargo sem funcionários', async () => {
      mockPrisma.role.findFirst.mockResolvedValueOnce({ id: 'role-id', name: 'Dev' });
      mockPrisma.employee.count.mockResolvedValueOnce(0);
      mockPrisma.role.update.mockResolvedValueOnce({});

      const result = await service.remove('comp-id', 'role-id');
      expect(result.message).toContain('removido com sucesso');
    });
  });
});
