import { GuardianRelationship as PrismaGuardianRelationship } from "@prisma/client";
import { GuardianRelationshipType } from "@/domain/user-management/entities/guardian-relationship-type.entity";
import { Prisma } from "@prisma/client";

export class PrismaGuardianRelationshipTypeMapper {
  static toDomain(
    prisma: PrismaGuardianRelationship,
  ): GuardianRelationshipType {
    return GuardianRelationshipType.create(
      {
        campusId: prisma.campusId,
        name: prisma.name,
        description: prisma.description,
        isArchived: prisma.isArchived,
        order: prisma.order,
        createdAt: prisma.createdAt,
        updatedAt: prisma.updatedAt,
      },
      prisma.id,
    );
  }

  static toPrisma(
    type: GuardianRelationshipType,
  ): Prisma.GuardianRelationshipUncheckedCreateInput {
    return {
      id: type.id,
      campusId: type.campusId,
      name: type.name,
      description: type.description,
      isArchived: type.isArchived,
      order: type.order,
      createdAt: type.createdAt,
      updatedAt: type.updatedAt,
    };
  }

  static toPrismaUpdate(
    type: GuardianRelationshipType,
  ): Prisma.GuardianRelationshipUncheckedUpdateInput {
    return {
      name: type.name,
      description: type.description,
      isArchived: type.isArchived,
      order: type.order,
      updatedAt: type.updatedAt,
    };
  }

  static toDomainArray(
    prismaTypes: PrismaGuardianRelationship[],
  ): GuardianRelationshipType[] {
    return prismaTypes.map((t) =>
      PrismaGuardianRelationshipTypeMapper.toDomain(t),
    );
  }
}
