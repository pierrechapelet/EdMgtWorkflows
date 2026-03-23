import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AppException } from '../common/exceptions/app.exception';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { PaginationDto, buildPaginationMeta } from '../common/dto/pagination.dto';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateRoleDto) {
    const code = `role_${randomUUID().slice(0, 8)}`;
    return this.prisma.role.create({
      data: {
        code,
        name: dto.name as Prisma.InputJsonValue,
        description: dto.description as Prisma.InputJsonValue,
      },
    });
  }

  async findAll(query: PaginationDto) {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const [roles, total] = await Promise.all([
      this.prisma.role.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.role.count(),
    ]);

    return { data: roles, meta: buildPaginationMeta(total, page, limit) };
  }

  async findOne(id: string) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new AppException('ROLE_NOT_FOUND', 'Role not found', 404);
    return role;
  }

  async findByCode(code: string) {
    const role = await this.prisma.role.findUnique({ where: { code } });
    if (!role) throw new AppException('ROLE_NOT_FOUND', `Role '${code}' not found`, 404);
    return role;
  }

  async update(id: string, dto: UpdateRoleDto) {
    await this.findOne(id);
    return this.prisma.role.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name as Prisma.InputJsonValue }),
        ...(dto.description && { description: dto.description as Prisma.InputJsonValue }),
      },
    });
  }
}
