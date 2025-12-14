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
  spouse?: PrismaGuardian | null;
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
   * Supports eager-loaded spouse and children data
   */
  static toDomain(prismaGuardian: PrismaGuardianWithRelations): Guardian {
    const guardianProps = {
      fullName: prismaGuardian.fullName,
      email: prismaGuardian.email,
      phoneNumber: prismaGuardian.phoneNumber,
      address: prismaGuardian.address,
      dateOfBirth: prismaGuardian.dateOfBirth,
      gender: prismaGuardian.gender as Gender | null,
      occupation: prismaGuardian.occupation,
      workAddress: prismaGuardian.workAddress,
      spouseId: prismaGuardian.spouseId,
      userId: prismaGuardian.userId,
      isArchived: prismaGuardian.isArchived,
      createdAt: prismaGuardian.createdAt,
      updatedAt: prismaGuardian.updatedAt,
    };

    const guardian = Guardian.create(guardianProps, prismaGuardian.id);

    // Handle eager-loaded spouse (Note: this creates a new Guardian instance for spouse)
    // The relation should be managed by the repository layer if it's not a direct value object.
    // For now, if we need to hydrate 'spouse' as a full Guardian object, it would be here.
    // However, the domain entity doesn't directly hold 'spouse: Guardian' in its props.
    // It's better to keep the domain entity clean and let the repository build the aggregate.
    // So, we don't try to attach a hydrated spouse here.

    // Handle eager-loaded children
    // The domain entity doesn't hold 'children: GuardianStudent[]' in its props.
    // This is also a relation to be managed by the repository layer.
    // For returning full aggregates, the repository would construct this after hydration.
    // The existing GuardianStudent interface needs to be updated if it contains a 'Student' interface.

    return guardian;
  }

  /**
   * Convert Prisma model to Domain entity (without nested relations)
   * Use to prevent circular references
   */
  static toDomainSimple(prismaGuardian: PrismaGuardian): Guardian {
    const guardianProps = {
      fullName: prismaGuardian.fullName,
      email: prismaGuardian.email,
      phoneNumber: prismaGuardian.phoneNumber,
      address: prismaGuardian.address,
      dateOfBirth: prismaGuardian.dateOfBirth,
      gender: prismaGuardian.gender as Gender | null,
      occupation: prismaGuardian.occupation,
      workAddress: prismaGuardian.workAddress,
      spouseId: prismaGuardian.spouseId,
      userId: prismaGuardian.userId,
      isArchived: prismaGuardian.isArchived,
      createdAt: prismaGuardian.createdAt,
      updatedAt: prismaGuardian.updatedAt,
    };
    return Guardian.create(guardianProps, prismaGuardian.id);
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
      spouseId: guardian.spouseId,
      userId: guardian.userId,
      createdAt: guardian.createdAt,
      updatedAt: guardian.updatedAt,
    };
  }

  /**
   * Convert Domain entity to Prisma update input
   */
  static toPrismaUpdate(guardian: Guardian): Prisma.GuardianUpdateInput {
    // Only include properties that are explicitly changed or are part of the entity's state.
    // The entity's getters provide the current state.
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

    // Handle explicit disconnects if userId or spouseId are set to null by the domain
    if (guardian.userId === null) {
      data.user = { disconnect: true };
    } else if (guardian.userId) {
      data.user = { connect: { id: guardian.userId } };
    }

    if (guardian.spouseId === null) {
      data.spouse = { disconnect: true };
    } else if (guardian.spouseId) {
      data.spouse = { connect: { id: guardian.spouseId } };
    }

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
