/**
 * Prisma Guardian Mapper
 * Maps between Prisma Guardian model and domain Guardian entity
 * Personal information is stored directly in Guardian (denormalized)
 */

import { Guardian as PrismaGuardian } from '@prisma/client';
import { Guardian } from '../../../../domain/user-management/guardian.entity';
import { Prisma } from '@prisma/client';

export class PrismaGuardianMapper {
  /**
   * Map Prisma model to domain entity
   * Supports eager-loaded spouse data
   */
  static toDomain(
    prismaGuardian: PrismaGuardian & {
      spouse?: PrismaGuardian | null;
    },
  ): Guardian {
    return {
      id: prismaGuardian.id,
      fullName: prismaGuardian.fullName,
      email: prismaGuardian.email,
      phoneNumber: prismaGuardian.phoneNumber,
      address: prismaGuardian.address,
      dateOfBirth: prismaGuardian.dateOfBirth,
      gender: prismaGuardian.gender,
      occupation: prismaGuardian.occupation,
      workAddress: prismaGuardian.workAddress,
      spouseId: prismaGuardian.spouseId,
      userId: prismaGuardian.userId,
      isArchived: prismaGuardian.isArchived,
      spouse: prismaGuardian.spouse ? this.toDomain(prismaGuardian.spouse) : undefined,
      createdAt: prismaGuardian.createdAt,
      updatedAt: prismaGuardian.updatedAt,
    };
  }

  /**
   * Map domain entity to Prisma create input
   */
  static toPrismaCreate(
    guardian: Omit<Guardian, 'id' | 'createdAt' | 'updatedAt' | 'spouse'>,
  ): Prisma.GuardianCreateInput {
    return {
      fullName: guardian.fullName,
      email: guardian.email,
      phoneNumber: guardian.phoneNumber,
      address: guardian.address,
      dateOfBirth: guardian.dateOfBirth,
      gender: guardian.gender,
      occupation: guardian.occupation,
      workAddress: guardian.workAddress,
      isArchived: guardian.isArchived ?? false,
      ...(guardian.userId && {
        user: {
          connect: { id: guardian.userId },
        },
      }),
      ...(guardian.spouseId && {
        spouse: {
          connect: { id: guardian.spouseId },
        },
      }),
    };
  }

  /**
   * Map partial domain entity to Prisma update input
   */
  static toPrismaUpdate(
    guardian: Partial<Omit<Guardian, 'id' | 'createdAt' | 'updatedAt' | 'spouse'>>,
  ): Prisma.GuardianUpdateInput {
    const data: Prisma.GuardianUpdateInput = {};

    if (guardian.fullName !== undefined) data.fullName = guardian.fullName;
    if (guardian.email !== undefined) data.email = guardian.email;
    if (guardian.phoneNumber !== undefined) data.phoneNumber = guardian.phoneNumber;
    if (guardian.address !== undefined) data.address = guardian.address;
    if (guardian.dateOfBirth !== undefined) data.dateOfBirth = guardian.dateOfBirth;
    if (guardian.gender !== undefined) data.gender = guardian.gender;
    if (guardian.occupation !== undefined) data.occupation = guardian.occupation;
    if (guardian.workAddress !== undefined) data.workAddress = guardian.workAddress;
    if (guardian.isArchived !== undefined) data.isArchived = guardian.isArchived;

    if (guardian.userId !== undefined) {
      data.user = guardian.userId
        ? { connect: { id: guardian.userId } }
        : { disconnect: true };
    }

    if (guardian.spouseId !== undefined) {
      if (guardian.spouseId === null) {
        data.spouse = { disconnect: true };
      } else {
        data.spouse = { connect: { id: guardian.spouseId } };
      }
    }

    return data;
  }
}
