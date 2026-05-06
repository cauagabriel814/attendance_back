import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(companyId: string, dto: CreateRoleDto) {
    const existing = await this.prisma.role.findFirst({
      where: { companyId, name: dto.name, deletedAt: null },
    });
    if (existing) throw new ConflictException(`Cargo "${dto.name}" já existe nesta empresa`);

    return this.prisma.role.create({
      data: {
        companyId,
        name: dto.name,
        permissions: dto.permissions ?? [],
      },
      select: { id: true, name: true, permissions: true, createdAt: true },
    });
  }

  async findAll(companyId: string) {
    return this.prisma.role.findMany({
      where: { companyId, deletedAt: null },
      select: {
        id: true,
        name: true,
        permissions: true,
        createdAt: true,
        _count: { select: { employees: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async update(companyId: string, roleId: string, dto: Partial<CreateRoleDto>) {
    const role = await this.findOneOrFail(companyId, roleId);

    if (dto.name && dto.name !== role.name) {
      const nameConflict = await this.prisma.role.findFirst({
        where: { companyId, name: dto.name, deletedAt: null, NOT: { id: roleId } },
      });
      if (nameConflict) throw new ConflictException(`Cargo "${dto.name}" já existe nesta empresa`);
    }

    return this.prisma.role.update({
      where: { id: roleId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.permissions !== undefined && { permissions: dto.permissions }),
      },
      select: { id: true, name: true, permissions: true },
    });
  }

  async remove(companyId: string, roleId: string) {
    const role = await this.findOneOrFail(companyId, roleId);

    // Verificar se há funcionários usando este cargo
    const employeeCount = await this.prisma.employee.count({
      where: { roleId: role.id, deletedAt: null },
    });
    if (employeeCount > 0) {
      throw new ForbiddenException(
        `Não é possível excluir o cargo "${role.name}" pois há ${employeeCount} funcionário(s) associado(s)`,
      );
    }

    await this.prisma.role.update({
      where: { id: roleId },
      data: { deletedAt: new Date() },
    });

    return { message: `Cargo "${role.name}" removido com sucesso` };
  }

  private async findOneOrFail(companyId: string, roleId: string) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, companyId, deletedAt: null },
    });
    if (!role) throw new NotFoundException('Cargo não encontrado');
    return role;
  }
}
