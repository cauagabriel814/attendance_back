import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../common/crypto/crypto.service';
import { AuthService } from '../auth/auth.service';
import { NotificationService } from '../notification/notification.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { validateCpf } from '../common/utils/cpf.validator';

const BCRYPT_COST = 12;

@Injectable()
export class EmployeeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly auth: AuthService,
    private readonly notification: NotificationService,
  ) {}

  async create(companyId: string, dto: CreateEmployeeDto) {
    // 1. Validar CPF (algoritmo)
    const cleanCpf = dto.cpf.replace(/\D/g, '');
    if (!validateCpf(cleanCpf)) {
      throw new BadRequestException('CPF inválido');
    }

    // 2. Verificar limite de funcionários da empresa
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, deletedAt: null },
    });
    if (!company) throw new NotFoundException('Empresa não encontrada');

    const activeCount = await this.prisma.employee.count({
      where: { companyId, deletedAt: null, isActive: true },
    });
    if (activeCount >= company.maxEmployees) {
      throw new ForbiddenException(
        `Limite de ${company.maxEmployees} funcionário(s) atingido`,
      );
    }

    // 3. Verificar se o role pertence à empresa
    const role = await this.prisma.role.findFirst({
      where: { id: dto.roleId, companyId, deletedAt: null },
    });
    if (!role) throw new NotFoundException('Cargo não encontrado nesta empresa');

    // 4. Verificar e-mail duplicado
    const emailExists = await this.prisma.employee.findFirst({
      where: { email: dto.email, deletedAt: null },
    });
    if (emailExists) throw new ConflictException('E-mail já cadastrado');

    // 5. Criptografar CPF (LGPD) e hash da senha
    const cpfEncrypted = this.crypto.encryptCpf(cleanCpf);
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_COST);

    // 6. Token de verificação de e-mail
    const emailVerificationToken = this.crypto.generateUuidToken();
    const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // 7. Criar funcionário
    const employee = await this.prisma.employee.create({
      data: {
        companyId,
        roleId: dto.roleId,
        name: dto.name,
        email: dto.email,
        cpfEncrypted,
        birthDate: new Date(dto.birthDate),
        entryTime: dto.entryTime,
        exitTime: dto.exitTime,
        lateToleranceAllowed: dto.lateToleranceAllowed,
        // Respeita a regra da empresa: se empresa não permite, força false
        overtimeAllowed: company.allowOvertime ? dto.overtimeAllowed : false,
        passwordHash,
        emailVerificationToken,
        emailVerificationExpires,
      },
    });

    // 8. E-mail de boas-vindas (assíncrono)
    void this.notification.sendEmployeeWelcome(
      employee.email,
      employee.name,
      company.ownerName,
      emailVerificationToken,
      employee.id,
    );

    return {
      message: 'Funcionário cadastrado. Um e-mail de boas-vindas foi enviado.',
      employeeId: employee.id,
    };
  }

  async verifyEmail(token: string) {
    const employee = await this.prisma.employee.findFirst({
      where: {
        emailVerificationToken: token,
        emailVerified: false,
        emailVerificationExpires: { gt: new Date() },
        deletedAt: null,
      },
    });

    if (!employee) {
      throw new BadRequestException('Token de verificação inválido ou expirado');
    }

    await this.prisma.employee.update({
      where: { id: employee.id },
      data: {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
      },
    });

    return { message: 'E-mail verificado com sucesso.' };
  }

  async login(email: string, password: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { email, deletedAt: null, isActive: true },
      include: { role: true, company: { select: { ownerName: true, allowOvertime: true } } },
    });

    if (!employee) throw new UnauthorizedException('Credenciais inválidas');

    if (!employee.emailVerified) {
      throw new UnauthorizedException('E-mail não verificado. Verifique sua caixa de entrada.');
    }

    const match = await bcrypt.compare(password, employee.passwordHash);
    if (!match) throw new UnauthorizedException('Credenciais inválidas');

    const tokens = await this.auth.generateTokens({
      sub: employee.id,
      type: 'employee',
      email: employee.email,
    });

    return {
      ...tokens,
      employee: {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        entryTime: employee.entryTime,
        exitTime: employee.exitTime,
        role: employee.role.name,
        overtimeAllowed: employee.overtimeAllowed,
        lateToleranceAllowed: employee.lateToleranceAllowed,
      },
    };
  }

  async refresh(userId: string, rawToken: string, email: string) {
    return this.auth.refreshTokens(userId, 'employee', rawToken, email);
  }

  async logout(userId: string) {
    await this.auth.revokeAllTokens(userId, 'employee');
    return { message: 'Logout realizado com sucesso' };
  }

  /** Listagem para o admin — CPF mascarado */
  async findAll(companyId: string) {
    const employees = await this.prisma.employee.findMany({
      where: { companyId, deletedAt: null },
      select: {
        id: true,
        name: true,
        email: true,
        cpfEncrypted: true,
        entryTime: true,
        exitTime: true,
        isActive: true,
        lateToleranceAllowed: true,
        overtimeAllowed: true,
        createdAt: true,
        role: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
    });

    return employees.map((emp) => ({
      ...emp,
      cpf: this.crypto.maskCpf(this.crypto.decryptCpf(emp.cpfEncrypted)),
      cpfEncrypted: undefined, // nunca retornar o campo criptografado
    }));
  }

  /** Perfil completo — CPF descriptografado apenas para o próprio funcionário */
  async getProfile(requesterId: string, targetId: string, requesterType: 'employee' | 'company') {
    const employee = await this.prisma.employee.findFirst({
      where: { id: targetId, deletedAt: null },
      include: { role: { select: { id: true, name: true, permissions: true } } },
    });

    if (!employee) throw new NotFoundException('Funcionário não encontrado');

    const isOwnProfile = requesterType === 'employee' && requesterId === targetId;
    const cpf = isOwnProfile
      ? this.crypto.decryptCpf(employee.cpfEncrypted)
      : this.crypto.maskCpf(this.crypto.decryptCpf(employee.cpfEncrypted));

    return {
      id: employee.id,
      name: employee.name,
      email: employee.email,
      cpf,
      birthDate: employee.birthDate,
      entryTime: employee.entryTime,
      exitTime: employee.exitTime,
      lateToleranceAllowed: employee.lateToleranceAllowed,
      overtimeAllowed: employee.overtimeAllowed,
      isActive: employee.isActive,
      createdAt: employee.createdAt,
      role: employee.role,
    };
  }

  async softDelete(companyId: string, employeeId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, companyId, deletedAt: null },
    });
    if (!employee) throw new NotFoundException('Funcionário não encontrado');

    await this.prisma.employee.update({
      where: { id: employeeId },
      data: { deletedAt: new Date(), isActive: false },
    });

    return { message: 'Funcionário desativado com sucesso' };
  }
}
