/**
 * Prisma User Mapper
 * Maps between Prisma User model and domain User entity
 *
 * NOTE: User only contains authentication info.
 * Personal info is stored directly in Guardian/Teacher tables.
 */

import { User as PrismaUser, Role as PrismaRole, UserRole as PrismaUserRole } from '@prisma/client';
import { User } from '../../../../domain/user-management/user.entity';
import { Prisma } from '@prisma/client';
import { PrismaRoleMapper } from './prisma-role.mapper';

export class PrismaUserMapper {
  /**
   * Map Prisma model to domain entity
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
      roles: prismaUser.userRoles?.map((ur) => PrismaRoleMapper.toDomain(ur.role)) ?? [],
      createdAt: prismaUser.createdAt,
      updatedAt: prismaUser.updatedAt,
    };
  }

  /**
   * Map domain entity to Prisma create input
   */
  static toPrismaCreate(
    user: Omit<User, 'id' | 'createdAt' | 'updatedAt' | 'roles'>,
  ): Prisma.UserCreateInput {
    return {
      clerkUid: user.clerkUid,
      isActive: user.isActive,
    };
  }

  /**
   * Map partial domain entity to Prisma update input
   */
  static toPrismaUpdate(
    user: Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt' | 'roles' | 'clerkUid'>>,
  ): Prisma.UserUpdateInput {
    const data: Prisma.UserUpdateInput = {};

    if (user.isActive !== undefined) data.isActive = user.isActive;

    return data;
  }
}
