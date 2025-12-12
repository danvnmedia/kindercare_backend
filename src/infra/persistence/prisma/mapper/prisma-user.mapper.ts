/**
 * Prisma User Mapper
 * Maps between Prisma User model and domain User entity
 *
 * NOTE: User only contains authentication info.
 * Personal info is stored directly in Guardian/Teacher tables.
 */

import {
  User as PrismaUser,
  Role as PrismaRole,
  UserRole as PrismaUserRole,
} from "@prisma/client";
import { User } from "../../../../domain/user-management/user.entity";
import { Prisma } from "@prisma/client";
import { PrismaRoleMapper } from "./prisma-role.mapper";

export class PrismaUserMapper {
  /**
   * Convert Prisma model to Domain entity (full)
   * Supports eager-loaded roles
   */
  static toDomain(
    prismaUser: PrismaUser & {
      userRoles?: Array<
        PrismaUserRole & {
          role: PrismaRole;
        }
      >;
    },
  ): User {
    return {
      id: prismaUser.id,
      clerkUid: prismaUser.clerkUid,
      isActive: prismaUser.isActive,
      roles:
        prismaUser.userRoles?.map((ur) => PrismaRoleMapper.toDomain(ur.role)) ??
        [],
      createdAt: prismaUser.createdAt,
      updatedAt: prismaUser.updatedAt,
    };
  }

  /**
   * Convert Prisma model to Domain entity (without nested relations)
   * Use to prevent circular references
   */
  static toDomainSimple(prismaUser: PrismaUser): User {
    return {
      id: prismaUser.id,
      clerkUid: prismaUser.clerkUid,
      isActive: prismaUser.isActive,
      roles: [],
      createdAt: prismaUser.createdAt,
      updatedAt: prismaUser.updatedAt,
    };
  }

  /**
   * Convert Domain entity to Prisma create input
   */
  static toPrisma(
    user: Omit<User, "id" | "createdAt" | "updatedAt" | "roles">,
  ): Prisma.UserUncheckedCreateInput {
    return {
      clerkUid: user.clerkUid,
      isActive: user.isActive,
    };
  }

  /**
   * Convert Domain entity to Prisma update input
   */
  static toPrismaUpdate(
    user: Partial<
      Omit<User, "id" | "createdAt" | "updatedAt" | "roles" | "clerkUid">
    >,
  ): Prisma.UserUpdateInput {
    const data: Prisma.UserUpdateInput = {};

    if (user.isActive !== undefined) data.isActive = user.isActive;

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
