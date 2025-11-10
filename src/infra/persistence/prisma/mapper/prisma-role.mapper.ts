/**
 * Prisma Role Mapper
 * Maps between Prisma Role model and domain Role entity
 */

import { Role as PrismaRole } from '@prisma/client';
import { Role } from '../../../../domain/user-management/role.entity';
import { Prisma } from '@prisma/client';

export class PrismaRoleMapper {
  /**
   * Map Prisma model to domain entity
   */
  static toDomain(prismaRole: PrismaRole): Role {
    return {
      id: prismaRole.id,
      name: prismaRole.name,
      description: prismaRole.description,
      permissions: prismaRole.permissions as Record<string, any>,
      isActive: true, // Note: Prisma schema doesn't have isActive field yet
      createdAt: prismaRole.createdAt,
      updatedAt: prismaRole.updatedAt,
    };
  }

  /**
   * Map domain entity to Prisma create input
   */
  static toPrismaCreate(role: Omit<Role, 'id' | 'createdAt' | 'updatedAt'>): Prisma.RoleCreateInput {
    return {
      name: role.name,
      description: role.description,
      permissions: role.permissions as Prisma.InputJsonValue,
    };
  }

  /**
   * Map partial domain entity to Prisma update input
   */
  static toPrismaUpdate(role: Partial<Role>): Prisma.RoleUpdateInput {
    const data: Prisma.RoleUpdateInput = {};

    if (role.name !== undefined) data.name = role.name;
    if (role.description !== undefined) data.description = role.description;
    if (role.permissions !== undefined) {
      data.permissions = role.permissions as Prisma.InputJsonValue;
    }

    return data;
  }
}
