/**
 * Prisma Role Mapper
 * Maps between Prisma Role model and domain Role entity
 */

import { Role as PrismaRole, Prisma } from "@prisma/client";
import {
  Role,
  CreateRoleData,
} from "../../../../domain/user-management/role.entity";

export class PrismaRoleMapper {
  /**
   * Convert Prisma model to Domain entity (full)
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
   * Convert Prisma model to Domain entity (without nested relations)
   * Use to prevent circular references
   */
  static toDomainSimple(prismaRole: PrismaRole): Role {
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
   * Convert Domain entity to Prisma create input
   */
  static toPrisma(role: CreateRoleData): Prisma.RoleUncheckedCreateInput {
    return {
      id: role.id,
      name: role.name,
      description: role.description,
      permissions: role.permissions as Prisma.InputJsonValue,
    };
  }

  /**
   * Convert Domain entity to Prisma update input
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

  /**
   * Convert array of Prisma models to Domain entities
   */
  static toDomainArray(prismaRoles: PrismaRole[]): Role[] {
    return prismaRoles.map((prismaRole) =>
      PrismaRoleMapper.toDomain(prismaRole),
    );
  }
}
