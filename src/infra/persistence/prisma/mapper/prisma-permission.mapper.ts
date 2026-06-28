/**
 * Prisma Permission Mapper
 * Maps between Prisma Permission model and domain Permission entity
 */

import { Permission as PrismaPermission, Prisma } from "@prisma/client";
import { Permission, CreatePermissionData } from "@/domain/rbac";

export class PrismaPermissionMapper {
  /**
   * Convert Prisma model to Domain entity
   */
  static toDomain(prismaPermission: PrismaPermission): Permission {
    return {
      id: prismaPermission.id,
      module: prismaPermission.module,
      description: prismaPermission.description,
      createdAt: prismaPermission.createdAt,
    };
  }

  /**
   * Convert Domain entity to Prisma create input
   */
  static toPrisma(
    data: CreatePermissionData,
  ): Prisma.PermissionUncheckedCreateInput {
    return {
      id: data.id,
      module: data.module,
      description: data.description ?? null,
    };
  }

  /**
   * Convert array of Prisma models to Domain entities
   */
  static toDomainArray(prismaPermissions: PrismaPermission[]): Permission[] {
    return prismaPermissions.map((p) => PrismaPermissionMapper.toDomain(p));
  }
}
