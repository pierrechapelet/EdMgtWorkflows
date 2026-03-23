import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AppException } from '../common/exceptions/app.exception';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

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
}
