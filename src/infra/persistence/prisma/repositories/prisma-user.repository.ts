import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { UserRepository, FindAllUsersParams, PaginatedUsers } from '@/application/user-management/ports/user.repository';
import { User } from '@/domain/user-management';
import { PrismaUserMapper } from '../mapper/prisma-user.mapper';

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<User | null> {
    const prismaUser = await this.prisma.user.findUnique({
      where: { id },
      include: { roles: true },
    });
    return prismaUser ? PrismaUserMapper.toDomain(prismaUser) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const prismaUser = await this.prisma.user.findUnique({
      where: { email },
      include: { roles: true },
    });
    return prismaUser ? PrismaUserMapper.toDomain(prismaUser) : null;
  }

  async findByClerkUid(clerkUid: string): Promise<User | null> {
    const prismaUser = await this.prisma.user.findUnique({
      where: { clerkUid },
      include: { roles: true },
    });
    return prismaUser ? PrismaUserMapper.toDomain(prismaUser) : null;
  }

  async findAll(params: FindAllUsersParams): Promise<PaginatedUsers> {
    const { page = 1, limit = 10, search, ids, isActive, roleIds, sortBy = 'id', order = 'asc' } = params;

    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { fullName: { contains: search, mode: 'insensitive' } },
        { phoneNumber: { contains: search } },
      ];
    }

    if (ids && ids.length > 0) {
      where.id = { in: ids };
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (roleIds && roleIds.length > 0) {
      where.roles = {
        some: {
          id: { in: roleIds },
        },
      };
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: order },
        include: { roles: true },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users.map(PrismaUserMapper.toDomain),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async save(user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const prismaData = PrismaUserMapper.toPrismaCreate(user);
    const created = await this.prisma.user.create({
      data: prismaData,
      include: { roles: true },
    });
    return PrismaUserMapper.toDomain(created);
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    const prismaData = PrismaUserMapper.toPrismaUpdate(data);
    const updated = await this.prisma.user.update({
      where: { id },
      data: prismaData,
      include: { roles: true },
    });
    return PrismaUserMapper.toDomain(updated);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.user.delete({
      where: { id },
    });
  }

  async assignRoles(userId: string, roleIds: string[]): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        roles: {
          connect: roleIds.map((roleId) => ({ id: roleId })),
        },
      },
    });
  }

  async removeRoles(userId: string, roleIds: string[]): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        roles: {
          disconnect: roleIds.map((roleId) => ({ id: roleId })),
        },
      },
    });
  }

  async getUserRoles(userId: string, page: number, limit: number): Promise<any> {
    const skip = (page - 1) * limit;

    const [roles, total] = await Promise.all([
      this.prisma.role.findMany({
        where: {
          users: {
            some: {
              id: userId,
            },
          },
        },
        skip,
        take: limit,
      }),
      this.prisma.role.count({
        where: {
          users: {
            some: {
              id: userId,
            },
          },
        },
      }),
    ]);

    return {
      data: roles,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
