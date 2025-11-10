/**
 * Prisma User Mapper
 * Maps between Prisma User model and domain User entity
 */

import { User as PrismaUser, Role as PrismaRole } from '@prisma/client';
import { User } from '../../../../domain/user-management/user.entity';
import { Prisma } from '@prisma/client';

export class PrismaUserMapper {
  /**
   * Map Prisma model to domain entity
   */
  static toDomain(
    prismaUser: PrismaUser & { roles?: PrismaRole[] },
  ): User {
    return {
      id: prismaUser.id,
      email: prismaUser.email,
      fullName: prismaUser.fullName,
      phoneNumber: prismaUser.phoneNumber,
      address: prismaUser.address,
      dateOfBirth: prismaUser.dateOfBirth,
      clerkUid: prismaUser.clerkUid,
      isActive: prismaUser.isActive,
      createdAt: prismaUser.createdAt,
      updatedAt: prismaUser.updatedAt,
    };
  }

  /**
   * Map domain entity to Prisma create input
   */
  static toPrismaCreate(user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Prisma.UserCreateInput {
    return {
      clerkUid: user.clerkUid,
      email: user.email,
      fullName: user.fullName,
      phoneNumber: user.phoneNumber,
      address: user.address,
      dateOfBirth: user.dateOfBirth,
      isActive: user.isActive,
    };
  }

  /**
   * Map partial domain entity to Prisma update input
   */
  static toPrismaUpdate(user: Partial<User>): Prisma.UserUpdateInput {
    const data: Prisma.UserUpdateInput = {};

    if (user.email !== undefined) data.email = user.email;
    if (user.fullName !== undefined) data.fullName = user.fullName;
    if (user.phoneNumber !== undefined) data.phoneNumber = user.phoneNumber;
    if (user.address !== undefined) data.address = user.address;
    if (user.dateOfBirth !== undefined) data.dateOfBirth = user.dateOfBirth;
    if (user.isActive !== undefined) data.isActive = user.isActive;

    return data;
  }
}
