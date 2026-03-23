import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AppException } from '../common/exceptions/app.exception';
import { AssignRoleDto } from './dto/assign-role.dto';
import { buildPaginationMeta, PaginationDto } from '../common/dto/pagination.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: PaginationDto) {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where: { isActive: true },
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          phone: true,
          preferredLang: true,
          mfaEnabled: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where: { isActive: true } }),
    ]);

    return { data: users, meta: buildPaginationMeta(total, page, limit) };
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id, isActive: true },
      select: {
        id: true,
        email: true,
        phone: true,
        preferredLang: true,
        mfaEnabled: true,
        createdAt: true,
        updatedAt: true,
        roleAssignments: {
          where: {
            OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }],
          },
          select: {
            id: true,
            validFrom: true,
            validUntil: true,
            role: { select: { id: true, code: true, name: true } },
            xeduNode: { select: { id: true, code: true, nodeType: true, name: true } },
          },
        },
      },
    });

    if (!user) throw new AppException('USER_NOT_FOUND', 'User not found', 404);
    return user;
  }

  async findByEmail(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email, isActive: true },
      select: { id: true, email: true, isActive: true },
    });
    if (!user) throw new AppException('USER_NOT_FOUND', 'User not found', 404);
    return user;
  }

  // ─── Role assignments ───────────────────────────────────────────────────────

  async getRoleAssignments(userId: string) {
    await this.assertUserExists(userId);
    return this.prisma.userRoleAssignment.findMany({
      where: {
        userId,
        OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }],
      },
      include: {
        role: { select: { id: true, code: true, name: true } },
        xeduNode: { select: { id: true, code: true, nodeType: true, name: true } },
        grantedBy: { select: { id: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async assignRole(userId: string, dto: AssignRoleDto, grantedById: string) {
    await this.assertUserExists(userId);

    // Verify role and node exist
    const [role, node] = await Promise.all([
      this.prisma.role.findUnique({ where: { id: dto.roleId } }),
      this.prisma.xeduNode.findUnique({ where: { id: dto.xeduNodeId } }),
    ]);

    if (!role) throw new AppException('ROLE_NOT_FOUND', 'Role not found', 404);
    if (!node) throw new AppException('NODE_NOT_FOUND', 'Xedu node not found', 404);

    // Upsert: if assignment already exists (including expired), create new
    return this.prisma.userRoleAssignment.create({
      data: {
        userId,
        roleId: dto.roleId,
        xeduNodeId: dto.xeduNodeId,
        grantedById,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : new Date(),
        validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
      },
      include: {
        role: { select: { id: true, code: true, name: true } },
        xeduNode: { select: { id: true, code: true, nodeType: true, name: true } },
      },
    });
  }

  async revokeRoleAssignment(userId: string, assignmentId: string) {
    await this.assertUserExists(userId);

    const assignment = await this.prisma.userRoleAssignment.findFirst({
      where: { id: assignmentId, userId },
    });

    if (!assignment) {
      throw new AppException('ASSIGNMENT_NOT_FOUND', 'Role assignment not found', 404);
    }

    // Revoke by setting validUntil to now
    return this.prisma.userRoleAssignment.update({
      where: { id: assignmentId },
      data: { validUntil: new Date() },
    });
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private async assertUserExists(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id, isActive: true },
      select: { id: true },
    });
    if (!user) throw new AppException('USER_NOT_FOUND', 'User not found', 404);
    return user;
  }
}
