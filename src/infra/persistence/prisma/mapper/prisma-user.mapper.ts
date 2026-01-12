/**
 * Prisma User Mapper
 * Maps between Prisma User model and domain User entity
 *
 * NOTE: User only contains authentication info.
 * Personal info is stored directly in Guardian/Staff tables.
 */

import {
  User as PrismaUser,
  Role as PrismaRole,
  UserRole as PrismaUserRole,
  RolePermission as PrismaRolePermission,
  Permission as PrismaPermission,
} from "@prisma/client";
import {
  User,
  UserRoleAssignment,
} from "../../../../domain/user-management/user.entity";
import { Prisma } from "@prisma/client";
import { PrismaRoleMapper } from "./prisma-role.mapper";

/**
 * Type for UserRole with full role data including permissions
 */
type PrismaUserRoleWithRole = PrismaUserRole & {
  role: PrismaRole & {
    rolePermissions?: Array<
      PrismaRolePermission & {
        permission: PrismaPermission;
      }
    >;
  };
};

export class PrismaUserMapper {
  /**
   * Convert Prisma model to Domain entity (full)
   * Supports eager-loaded roles with campus context
   */
  static toDomain(
    prismaUser: PrismaUser & {
      userRoles?: PrismaUserRoleWithRole[];
    },
  ): User {
    const roleAssignments: UserRoleAssignment[] =
      prismaUser.userRoles?.map((ur) => ({
        role: PrismaRoleMapper.toDomain(ur.role),
        campusId: ur.campusId,
        assignedAt: ur.assignedAt,
      })) ?? [];

    return User.reconstitute(
      {
        clerkUid: prismaUser.clerkUid,
        isActive: prismaUser.isActive,
        roleAssignments,
        createdAt: prismaUser.createdAt,
        updatedAt: prismaUser.updatedAt,
      },
      prismaUser.id,
    );
  }

  /**
   * Convert Prisma model to Domain entity (without nested relations)
   * Use to prevent circular references
   */
  static toDomainSimple(prismaUser: PrismaUser): User {
    return User.reconstitute(
      {
        clerkUid: prismaUser.clerkUid,
        isActive: prismaUser.isActive,
        roleAssignments: [],
        createdAt: prismaUser.createdAt,
        updatedAt: prismaUser.updatedAt,
      },
      prismaUser.id,
    );
  }

  /**
   * Convert Domain entity to Prisma create input
   */
  static toPrisma(user: User): Prisma.UserUncheckedCreateInput {
    return {
      id: user.id,
      clerkUid: user.clerkUid,
      isActive: user.isActive,
    };
  }

  /**
   * Convert Domain entity to Prisma update input
   */
  static toPrismaUpdate(user: User): Prisma.UserUpdateInput {
    const data: Prisma.UserUpdateInput = {
      isActive: user.isActive,
      updatedAt: user.updatedAt,
    };

    return data;
  }

  /**
   * Convert array of Prisma models to Domain entities
   */
  static toDomainArray(
    prismaUsers: (PrismaUser & {
      userRoles?: Array<
        PrismaUserRole & {
          role: PrismaRole;
        }
      >;
    })[],
  ): User[] {
    return prismaUsers.map((prismaUser) =>
      PrismaUserMapper.toDomain(prismaUser),
    );
  }
}
