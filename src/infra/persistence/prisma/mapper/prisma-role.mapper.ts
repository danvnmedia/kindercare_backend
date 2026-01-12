/**
 * Prisma Role Mapper
 * Maps between Prisma Role model and domain Role entity
 */

import {
  Role as PrismaRole,
  Permission as PrismaPermission,
  Prisma,
} from "@prisma/client";
import {
  Role,
  CreateRoleData,
  UpdateRoleData,
} from "../../../../domain/user-management/role.entity";
import { Permission } from "@/domain/rbac";
import { PrismaPermissionMapper } from "./prisma-permission.mapper";

/**
 * Prisma Role with relations type
 */
type PrismaRoleWithPermissions = PrismaRole & {
  rolePermissions?: Array<{
    permission: PrismaPermission;
  }>;
};

export class PrismaRoleMapper {
  /**
   * Convert Prisma model to Domain entity (full, with permissions)
   */
  static toDomain(prismaRole: PrismaRoleWithPermissions): Role {
    // Map permissions from rolePermissions relation
    const permissions: Permission[] =
      prismaRole.rolePermissions?.map((rp) =>
        PrismaPermissionMapper.toDomain(rp.permission),
      ) ?? [];

    return {
      id: prismaRole.id,
      name: prismaRole.name,
      description: prismaRole.description,
      campusId: prismaRole.campusId,
      isSystemDefault: prismaRole.isSystemDefault,
      isSystemRole: prismaRole.isSystemRole,
      permissions,
      createdAt: prismaRole.createdAt,
      updatedAt: prismaRole.updatedAt,
    };
  }

  /**
   * Convert Prisma model to Domain entity (without permissions)
   * Use for listing where permissions are not needed
   */
  static toDomainSimple(prismaRole: PrismaRole): Role {
    return {
      id: prismaRole.id,
      name: prismaRole.name,
      description: prismaRole.description,
      campusId: prismaRole.campusId,
      isSystemDefault: prismaRole.isSystemDefault,
      isSystemRole: prismaRole.isSystemRole,
      permissions: [], // Empty array for simple mapping
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
      description: role.description ?? null,
      campusId: role.campusId ?? null,
      isSystemDefault: role.isSystemDefault ?? false,
      isSystemRole: role.isSystemRole ?? false,
    };
  }

  /**
   * Convert Domain entity to Prisma update input
   */
  static toPrismaUpdate(role: UpdateRoleData): Prisma.RoleUpdateInput {
    const data: Prisma.RoleUpdateInput = {};

    if (role.name !== undefined) data.name = role.name;
    if (role.description !== undefined) data.description = role.description;
    if (role.campusId !== undefined && role.campusId !== null) {
      data.campus = { connect: { id: role.campusId } };
    }

    return data;
  }

  /**
   * Convert array of Prisma models to Domain entities (simple)
   */
  static toDomainArray(prismaRoles: PrismaRole[]): Role[] {
    return prismaRoles.map((prismaRole) =>
      PrismaRoleMapper.toDomainSimple(prismaRole),
    );
  }

  /**
   * Convert array of Prisma models to Domain entities (with permissions)
   */
  static toDomainArrayWithPermissions(
    prismaRoles: PrismaRoleWithPermissions[],
  ): Role[] {
    return prismaRoles.map((prismaRole) =>
      PrismaRoleMapper.toDomain(prismaRole),
    );
  }
}
