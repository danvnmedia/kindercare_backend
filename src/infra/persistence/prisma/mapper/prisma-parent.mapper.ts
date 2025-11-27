/**
 * Prisma Parent Mapper
 * Maps between Prisma Parent model and domain Parent entity
 * Personal information is now stored directly in Parent (denormalized)
 */

import { Parent as PrismaParent } from '@prisma/client';
import { Parent } from '../../../../domain/user-management/parent.entity';
import { Prisma } from '@prisma/client';

export class PrismaParentMapper {
  /**
   * Map Prisma model to domain entity
   * Supports eager-loaded spouse data
   */
  static toDomain(
    prismaParent: PrismaParent & {
      spouse?: PrismaParent | null;
    },
  ): Parent {
    return {
      id: prismaParent.id,
      fullName: prismaParent.fullName,
      email: prismaParent.email,
      phoneNumber: prismaParent.phoneNumber,
      address: prismaParent.address,
      dateOfBirth: prismaParent.dateOfBirth,
      gender: prismaParent.gender,
      occupation: prismaParent.occupation,
      workAddress: prismaParent.workAddress,
      spouseId: prismaParent.spouseId,
      userId: prismaParent.userId,
      isArchived: prismaParent.isArchived,
      spouse: prismaParent.spouse ? this.toDomain(prismaParent.spouse) : undefined,
      createdAt: prismaParent.createdAt,
      updatedAt: prismaParent.updatedAt,
    };
  }

  /**
   * Map domain entity to Prisma create input
   */
  static toPrismaCreate(
    parent: Omit<Parent, 'id' | 'createdAt' | 'updatedAt' | 'spouse'>,
  ): Prisma.ParentCreateInput {
    return {
      fullName: parent.fullName,
      email: parent.email,
      phoneNumber: parent.phoneNumber,
      address: parent.address,
      dateOfBirth: parent.dateOfBirth,
      gender: parent.gender,
      occupation: parent.occupation,
      workAddress: parent.workAddress,
      isArchived: parent.isArchived ?? false,
      ...(parent.userId && {
        user: {
          connect: { id: parent.userId },
        },
      }),
      ...(parent.spouseId && {
        spouse: {
          connect: { id: parent.spouseId },
        },
      }),
    };
  }

  /**
   * Map partial domain entity to Prisma update input
   */
  static toPrismaUpdate(
    parent: Partial<Omit<Parent, 'id' | 'createdAt' | 'updatedAt' | 'spouse'>>,
  ): Prisma.ParentUpdateInput {
    const data: Prisma.ParentUpdateInput = {};

    if (parent.fullName !== undefined) data.fullName = parent.fullName;
    if (parent.email !== undefined) data.email = parent.email;
    if (parent.phoneNumber !== undefined) data.phoneNumber = parent.phoneNumber;
    if (parent.address !== undefined) data.address = parent.address;
    if (parent.dateOfBirth !== undefined) data.dateOfBirth = parent.dateOfBirth;
    if (parent.gender !== undefined) data.gender = parent.gender;
    if (parent.occupation !== undefined) data.occupation = parent.occupation;
    if (parent.workAddress !== undefined) data.workAddress = parent.workAddress;
    if (parent.isArchived !== undefined) data.isArchived = parent.isArchived;

    if (parent.userId !== undefined) {
      data.user = parent.userId ? { connect: { id: parent.userId } } : { disconnect: true };
    }

    if (parent.spouseId !== undefined) {
      if (parent.spouseId === null) {
        data.spouse = { disconnect: true };
      } else {
        data.spouse = { connect: { id: parent.spouseId } };
      }
    }

    return data;
  }
}
