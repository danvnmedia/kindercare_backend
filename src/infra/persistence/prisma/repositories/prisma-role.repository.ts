import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import {
  RoleRepository,
  FindAllRolesParams,
  PaginatedRoles,
} from '../../../../application/user-management/ports/role.repository';
import { Role, CreateRoleData } from '../../../../domain/user-management/role.entity';
import { PrismaRoleMapper } from '../mapper/prisma-role.mapper';

@Injectable()
export class PrismaRoleRepository implements RoleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Role | null> {
    const prismaRole = await this.prisma.role.findUnique({
      where: { id },
    });

    return prismaRole ? PrismaRoleMapper.toDomain(prismaRole) : null;
  }

  async findByName(name: string): Promise<Role | null> {
    const prismaRole = await this.prisma.role.findUnique({
      where: { name },
    });

    return prismaRole ? PrismaRoleMapper.toDomain(prismaRole) : null;
  }

  async findAll(params: FindAllRolesParams): Promise<PaginatedRoles> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.RoleWhereInput = {
      AND: [
        params.search
          ? {
              OR: [
                { name: { contains: params.search, mode: 'insensitive' } },
                { description: { contains: params.search, mode: 'insensitive' } },
              ],
            }
          : {},
        params.ids && params.ids.length > 0 ? { id: { in: params.ids } } : {},
      ],
    };

    // Build orderBy clause
    const orderBy: Prisma.RoleOrderByWithRelationInput = {
      [params.sortBy ?? 'createdAt']: params.order ?? 'desc',
    };

    // Execute queries
    const [prismaRoles, total] = await Promise.all([
      this.prisma.role.findMany({
        where,
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.role.count({ where }),
    ]);

    return {
      data: prismaRoles.map(PrismaRoleMapper.toDomain),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / Math.max(limit, 1)),
    };
  }

  async save(role: CreateRoleData): Promise<Role> {
    const prismaData = PrismaRoleMapper.toPrismaCreate(role);

    const created = await this.prisma.role.create({
      data: prismaData,
    });

    return PrismaRoleMapper.toDomain(created);
  }

  async update(id: string, data: Partial<Role>): Promise<Role> {
    const prismaData = PrismaRoleMapper.toPrismaUpdate(data);

    const updated = await this.prisma.role.update({
      where: { id },
      data: prismaData,
    });

    return PrismaRoleMapper.toDomain(updated);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.role.delete({
      where: { id },
    });
  }

  async assignUsers(roleId: string, userIds: string[]): Promise<void> {
    if (!userIds.length) return;

    await this.prisma.userRole.createMany({
      data: userIds.map((userId) => ({ userId, roleId })),
      skipDuplicates: true,
    });
  }

  async removeUsers(roleId: string, userIds: string[]): Promise<void> {
    if (!userIds.length) return;

    await this.prisma.userRole.deleteMany({
      where: { roleId, userId: { in: userIds } },
    });
  }

  async getRoleUsers(roleId: string, page: number, limit: number): Promise<any> {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (safePage - 1) * safeLimit;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where: { userRoles: { some: { roleId } } },
        skip,
        take: safeLimit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          clerkUid: true,
          isActive: true,
          guardian: {
            select: {
              id: true,
              fullName: true,
              email: true,
              phoneNumber: true,
              dateOfBirth: true,
            },
          },
          teacher: {
            select: {
              id: true,
              fullName: true,
              email: true,
              phoneNumber: true,
              dateOfBirth: true,
            },
          },
        },
      }),
      this.prisma.user.count({
        where: { userRoles: { some: { roleId } } },
      }),
    ]);

    return {
      data: users,
      meta: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / Math.max(safeLimit, 1)),
      },
    };
  }
}
