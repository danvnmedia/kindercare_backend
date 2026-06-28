import {
  Guardian as PrismaGuardian,
  Prisma,
  Student as PrismaStudent,
  GuardianStudent as PrismaGuardianStudent,
  GuardianRelationship as PrismaGuardianRelationship,
} from "@prisma/client";
import { Guardian } from "@/domain/user-management/entities/guardian.entity";
import { Gender } from "@/domain/user-management/enums/gender.enum";

type PrismaGuardianWithRelations = PrismaGuardian & {
  children?: Array<
    PrismaGuardianStudent & {
      student: PrismaStudent;
      guardianRelationship: PrismaGuardianRelationship;
    }
  >;
};

export class PrismaGuardianMapper {
  /**
   * Convert Prisma model to Domain entity (full)
   * Supports eager-loaded children data
   */
  static toDomain(prismaGuardian: PrismaGuardianWithRelations): Guardian {
    return Guardian.reconstitute(
      {
        fullName: prismaGuardian.fullName,
        email: prismaGuardian.email,
        phoneNumber: prismaGuardian.phoneNumber,
        address: prismaGuardian.address,
        dateOfBirth: prismaGuardian.dateOfBirth,
        gender: prismaGuardian.gender as Gender | null,
        occupation: prismaGuardian.occupation,
        workAddress: prismaGuardian.workAddress,
        campusId: prismaGuardian.campusId,
        userId: prismaGuardian.userId,
        isArchived: prismaGuardian.isArchived,
        createdAt: prismaGuardian.createdAt,
        updatedAt: prismaGuardian.updatedAt,
      },
      prismaGuardian.id,
    );
  }

  /**
   * Convert Prisma model to Domain entity (without nested relations)
   * Use to prevent circular references
   */
  static toDomainSimple(prismaGuardian: PrismaGuardian): Guardian {
    return Guardian.reconstitute(
      {
        fullName: prismaGuardian.fullName,
        email: prismaGuardian.email,
        phoneNumber: prismaGuardian.phoneNumber,
        address: prismaGuardian.address,
        dateOfBirth: prismaGuardian.dateOfBirth,
        gender: prismaGuardian.gender as Gender | null,
        occupation: prismaGuardian.occupation,
        workAddress: prismaGuardian.workAddress,
        campusId: prismaGuardian.campusId,
        userId: prismaGuardian.userId,
        isArchived: prismaGuardian.isArchived,
        createdAt: prismaGuardian.createdAt,
        updatedAt: prismaGuardian.updatedAt,
      },
      prismaGuardian.id,
    );
  }

  /**
   * Convert Domain entity to Prisma create input
   */
  static toPrisma(guardian: Guardian): Prisma.GuardianUncheckedCreateInput {
    return {
      id: guardian.id,
      fullName: guardian.fullName,
      email: guardian.email,
      phoneNumber: guardian.phoneNumber,
      address: guardian.address,
      dateOfBirth: guardian.dateOfBirth,
      gender: guardian.gender,
      occupation: guardian.occupation,
      workAddress: guardian.workAddress,
      isArchived: guardian.isArchived,
      campusId: guardian.campusId,
      userId: guardian.userId,
      createdAt: guardian.createdAt,
      updatedAt: guardian.updatedAt,
    };
  }

  /**
   * Convert Domain entity to Prisma update input
   */
  static toPrismaUpdate(guardian: Guardian): Prisma.GuardianUpdateInput {
    const data: Prisma.GuardianUpdateInput = {
      fullName: guardian.fullName,
      email: guardian.email,
      phoneNumber: guardian.phoneNumber,
      address: guardian.address,
      dateOfBirth: guardian.dateOfBirth,
      gender: guardian.gender,
      occupation: guardian.occupation,
      workAddress: guardian.workAddress,
      isArchived: guardian.isArchived,
      updatedAt: guardian.updatedAt,
    };

    if (guardian.userId === null) {
      data.user = { disconnect: true };
    } else if (guardian.userId) {
      data.user = { connect: { id: guardian.userId } };
    }

    data.campus = { connect: { id: guardian.campusId } };

    return data;
  }

  /**
   * Convert array of Prisma models to Domain entities
   */
  static toDomainArray(
    prismaGuardians: PrismaGuardianWithRelations[],
  ): Guardian[] {
    return prismaGuardians.map((prismaGuardian) =>
      PrismaGuardianMapper.toDomain(prismaGuardian),
    );
  }
}
