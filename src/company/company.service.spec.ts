import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { CompanyService } from './company.service';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../common/crypto/crypto.service';
import { AuthService } from '../auth/auth.service';
import { NotificationService } from '../notification/notification.service';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockPrisma = {
  company: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
};

const mockCrypto = {
  sha256: jest.fn((v: string) => `hash_${v}`),
  generateUuidToken: jest.fn(() => 'uuid-token-mock'),
  encryptCpf: jest.fn((v: string) => `enc_${v}`),
  decryptCpf: jest.fn((v: string) => v.replace('enc_', '')),
  maskCpf: jest.fn(() => '***.***999-**'),
};

const mockAuth = {
  generateTokens: jest.fn().mockResolvedValue({
    accessToken: 'access_token',
    refreshToken: 'refresh_token',
  }),
  revokeAllTokens: jest.fn().mockResolvedValue(undefined),
};

const mockNotification = {
  sendEmailVerification: jest.fn().mockResolvedValue(undefined),
  sendEmployeeWelcome: jest.fn().mockResolvedValue(undefined),
};

// ─── Fábrica de DTO de empresa ─────────────────────────────────────────────

const makeDto = (overrides = {}) => ({
  email: 'empresa@teste.com',
  ownerName: 'João Silva',
  cnpj: '11.222.333/0001-81',
  ownerBirthDate: '1980-01-01',
  allowOvertime: false,
  maxEmployees: 10,
  password: 'SenhaForte@123',
  ...overrides,
});

// ─── Testes ───────────────────────────────────────────────────────────────────

describe('CompanyService', () => {
  let service: CompanyService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompanyService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CryptoService, useValue: mockCrypto },
        { provide: AuthService, useValue: mockAuth },
        { provide: NotificationService, useValue: mockNotification },
      ],
    }).compile();

    service = module.get<CompanyService>(CompanyService);
  });

  // ─── register ─────────────────────────────────────────────────────────────

  describe('register', () => {
    it('deve lançar BadRequestException para CNPJ inválido', async () => {
      await expect(service.register(makeDto({ cnpj: '00.000.000/0000-00' }))).rejects.toThrow(
        BadRequestException,
      );
    });

    it('deve lançar ConflictException se e-mail já cadastrado', async () => {
      mockPrisma.company.findFirst.mockResolvedValueOnce({ email: 'empresa@teste.com' });
      await expect(service.register(makeDto())).rejects.toThrow(ConflictException);
    });

    it('deve criar empresa e retornar ID quando dados são válidos', async () => {
      mockPrisma.company.findFirst.mockResolvedValueOnce(null);
      mockPrisma.company.create.mockResolvedValueOnce({
        id: 'company-uuid',
        email: 'empresa@teste.com',
        ownerName: 'João Silva',
      });

      const result = await service.register(makeDto({ cnpj: '11.222.333/0001-81' }));

      expect(result).toHaveProperty('companyId', 'company-uuid');
      expect(result.message).toContain('Verifique seu e-mail');
      expect(mockNotification.sendEmailVerification).toHaveBeenCalledTimes(1);
    });
  });

  // ─── verifyEmail ──────────────────────────────────────────────────────────

  describe('verifyEmail', () => {
    it('deve lançar BadRequestException para token inválido', async () => {
      mockPrisma.company.findFirst.mockResolvedValueOnce(null);
      await expect(service.verifyEmail('token-invalido')).rejects.toThrow(BadRequestException);
    });

    it('deve verificar e-mail com sucesso para token válido', async () => {
      mockPrisma.company.findFirst.mockResolvedValueOnce({ id: 'company-uuid' });
      mockPrisma.company.update.mockResolvedValueOnce({});

      const result = await service.verifyEmail('token-valido');
      expect(result.message).toContain('verificado com sucesso');
    });
  });

  // ─── login ────────────────────────────────────────────────────────────────

  describe('login', () => {
    const bcrypt = require('bcrypt');

    it('deve lançar UnauthorizedException para empresa inexistente', async () => {
      mockPrisma.company.findFirst.mockResolvedValueOnce(null);
      await expect(
        service.login({ email: 'x@x.com', password: 'senha' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('deve lançar UnauthorizedException se e-mail não verificado', async () => {
      mockPrisma.company.findFirst.mockResolvedValueOnce({
        id: 'id',
        email: 'x@x.com',
        emailVerified: false,
        passwordHash: 'hash',
      });
      await expect(
        service.login({ email: 'x@x.com', password: 'senha' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('deve retornar tokens para credenciais válidas', async () => {
      const passwordHash = await bcrypt.hash('SenhaForte@123', 10);
      mockPrisma.company.findFirst.mockResolvedValueOnce({
        id: 'company-uuid',
        email: 'empresa@teste.com',
        ownerName: 'João',
        emailVerified: true,
        passwordHash,
        allowOvertime: false,
        maxEmployees: 10,
      });

      const result = await service.login({
        email: 'empresa@teste.com',
        password: 'SenhaForte@123',
      });

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.company).toHaveProperty('id', 'company-uuid');
    });
  });

  // ─── logout ───────────────────────────────────────────────────────────────

  describe('logout', () => {
    it('deve revogar tokens e retornar mensagem de sucesso', async () => {
      const result = await service.logout('company-uuid');
      expect(mockAuth.revokeAllTokens).toHaveBeenCalledWith('company-uuid', 'company');
      expect(result.message).toContain('Logout');
    });
  });
});
