import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import {
  RoleRepository,
  FindAllRolesParams,
  PaginatedRoles,
} from '../../../../application/user-management/ports/role.repository';
import { Role } from '../../../../domain/user-management/role.entity';
import { PrismaRoleMapper } from '../mapper/prisma-role.mapper';

@Injectable()
export class PrismaRoleRepository implements RoleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: number): Promise<Role | null> {
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

  async save(role: Omit<Role, 'id' | 'createdAt' | 'updatedAt'>): Promise<Role> {
    const prismaData = PrismaRoleMapper.toPrismaCreate(role);

    const created = await this.prisma.role.create({
      data: prismaData,
    });

    return PrismaRoleMapper.toDomain(created);
  }

  async update(id: number, data: Partial<Role>): Promise<Role> {
    const prismaData = PrismaRoleMapper.toPrismaUpdate(data);

    const updated = await this.prisma.role.update({
      where: { id },
      data: prismaData,
    });

    return PrismaRoleMapper.toDomain(updated);
  }

  async delete(id: number): Promise<void> {
    await this.prisma.role.delete({
      where: { id },
    });
  }

  async assignUsers(roleId: number, userIds: number[]): Promise<void> {
    // Attach each user (idempotent)
    for (const userId of userIds) {
      // Check if already attached
      const existing = await this.prisma.user.count({
        where: {
          id: userId,
          roles: { some: { id: roleId } },
        },
      });

      if (existing === 0) {
        await this.prisma.user.update({
          where: { id: userId },
          data: {
            roles: { connect: { id: roleId } },
          },
        });
      }
    }
  }

  async removeUsers(roleId: number, userIds: number[]): Promise<void> {
    for (const userId of userIds) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          roles: { disconnect: { id: roleId } },
        },
      });
    }
  }

  async getRoleUsers(roleId: number, page: number, limit: number): Promise<any> {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (safePage - 1) * safeLimit;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where: { roles: { some: { id: roleId } } },
        skip,
        take: safeLimit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          fullName: true,
          dateOfBirth: true,
          phoneNumber: true,
          isActive: true,
        },
      }),
      this.prisma.user.count({
        where: { roles: { some: { id: roleId } } },
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
