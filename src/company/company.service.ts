import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../common/crypto/crypto.service';
import { AuthService } from '../auth/auth.service';
import { NotificationService } from '../notification/notification.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { LoginCompanyDto } from './dto/login-company.dto';
import { validateCnpj } from '../common/utils/cnpj.validator';

const BCRYPT_COST = 12;

@Injectable()
export class CompanyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly auth: AuthService,
    private readonly notification: NotificationService,
  ) {}

  async register(dto: CreateCompanyDto) {
    // 1. Validação do algoritmo CNPJ
    const cleanCnpj = dto.cnpj.replace(/\D/g, '');
    if (!validateCnpj(cleanCnpj)) {
      throw new BadRequestException('CNPJ inválido');
    }

    const cnpjHash = this.crypto.sha256(cleanCnpj);

    // 2. Verificar duplicatas
    const existing = await this.prisma.company.findFirst({
      where: {
        OR: [{ email: dto.email }, { cnpjHash }],
        deletedAt: null,
      },
    });
    if (existing) {
      throw new ConflictException(
        existing.email === dto.email
          ? 'E-mail já cadastrado'
          : 'CNPJ já cadastrado',
      );
    }

    // 3. Hash da senha
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_COST);

    // 4. Token de verificação de e-mail
    const emailVerificationToken = this.crypto.generateUuidToken();
    const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    // 5. Criar empresa
    const company = await this.prisma.company.create({
      data: {
        email: dto.email,
        ownerName: dto.ownerName,
        cnpjHash,
        ownerBirthDate: new Date(dto.ownerBirthDate),
        allowOvertime: dto.allowOvertime,
        maxOvertimeHours: dto.allowOvertime ? dto.maxOvertimeHours : null,
        maxEmployees: dto.maxEmployees,
        passwordHash,
        emailVerificationToken,
        emailVerificationExpires,
      },
    });

    // 6. Enviar e-mail de verificação (assíncrono, não bloqueia)
    void this.notification.sendEmailVerification(
      company.email,
      company.ownerName,
      emailVerificationToken,
      'company',
      company.id,
    );

    return {
      message: 'Empresa cadastrada. Verifique seu e-mail para ativar a conta.',
      companyId: company.id,
    };
  }

  async verifyEmail(token: string) {
    const company = await this.prisma.company.findFirst({
      where: {
        emailVerificationToken: token,
        emailVerified: false,
        emailVerificationExpires: { gt: new Date() },
        deletedAt: null,
      },
    });

    if (!company) {
      throw new BadRequestException('Token de verificação inválido ou expirado');
    }

    await this.prisma.company.update({
      where: { id: company.id },
      data: {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
      },
    });

    return { message: 'E-mail verificado com sucesso. Você pode fazer login agora.' };
  }

  async login(dto: LoginCompanyDto) {
    const company = await this.prisma.company.findFirst({
      where: { email: dto.email, deletedAt: null, isActive: true },
    });

    if (!company) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    if (!company.emailVerified) {
      throw new UnauthorizedException('E-mail não verificado. Verifique sua caixa de entrada.');
    }

    const passwordMatch = await bcrypt.compare(dto.password, company.passwordHash);
    if (!passwordMatch) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const tokens = await this.auth.generateTokens({
      sub: company.id,
      type: 'company',
      email: company.email,
    });

    return {
      ...tokens,
      company: {
        id: company.id,
        email: company.email,
        ownerName: company.ownerName,
        allowOvertime: company.allowOvertime,
        maxEmployees: company.maxEmployees,
      },
    };
  }

  async refresh(userId: string, rawRefreshToken: string, email: string) {
    return this.auth.refreshTokens(userId, 'company', rawRefreshToken, email);
  }

  async logout(userId: string) {
    await this.auth.revokeAllTokens(userId, 'company');
    return { message: 'Logout realizado com sucesso' };
  }

  async getProfile(companyId: string) {
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, deletedAt: null },
      select: {
        id: true,
        email: true,
        ownerName: true,
        ownerBirthDate: true,
        allowOvertime: true,
        maxOvertimeHours: true,
        maxEmployees: true,
        emailVerified: true,
        isActive: true,
        createdAt: true,
        _count: { select: { employees: true } },
      },
    });

    if (!company) throw new NotFoundException('Empresa não encontrada');
    return company;
  }
}
