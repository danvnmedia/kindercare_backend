import {
  GradeLevel as PrismaGradeLevel,
  Class as PrismaClass,
} from "@prisma/client";
import { GradeLevel } from "@/domain/class-management/entities/grade-level.entity";
import { Prisma } from "@prisma/client";
import { PrismaClassMapper } from "./prisma-class.mapper";

type PrismaGradeLevelWithClasses = PrismaGradeLevel & {
  classes?: PrismaClass[];
};

export class PrismaGradeLevelMapper {
  static toDomain(prismaGradeLevel: PrismaGradeLevel): GradeLevel {
    return GradeLevel.create(
      {
        name: prismaGradeLevel.name,
        order: prismaGradeLevel.order,
        isArchived: prismaGradeLevel.isArchived,
        createdAt: prismaGradeLevel.createdAt,
        updatedAt: prismaGradeLevel.updatedAt,
      },
      prismaGradeLevel.id,
    );
  }

  static toDomainWithClasses(
    prismaGradeLevel: PrismaGradeLevelWithClasses,
  ): GradeLevel {
    return GradeLevel.create(
      {
        name: prismaGradeLevel.name,
        order: prismaGradeLevel.order,
        isArchived: prismaGradeLevel.isArchived,
        classes: prismaGradeLevel.classes
          ? prismaGradeLevel.classes.map((c) =>
              PrismaClassMapper.toDomainSimple(c),
            )
          : undefined,
        createdAt: prismaGradeLevel.createdAt,
        updatedAt: prismaGradeLevel.updatedAt,
      },
      prismaGradeLevel.id,
    );
  }

  static toPrisma(
    gradeLevel: GradeLevel,
  ): Prisma.GradeLevelUncheckedCreateInput {
    return {
      id: gradeLevel.id,
      name: gradeLevel.name,
      order: gradeLevel.order,
      isArchived: gradeLevel.isArchived,
      createdAt: gradeLevel.createdAt,
      updatedAt: gradeLevel.updatedAt,
    };
  }

  static toPrismaUpdate(gradeLevel: GradeLevel): Prisma.GradeLevelUpdateInput {
    return {
      name: gradeLevel.name,
      order: gradeLevel.order,
      isArchived: gradeLevel.isArchived,
      updatedAt: gradeLevel.updatedAt,
    };
  }

  static toDomainArray(prismaGradeLevels: PrismaGradeLevel[]): GradeLevel[] {
    return prismaGradeLevels.map((g) => PrismaGradeLevelMapper.toDomain(g));
  }

  static toDomainArrayWithClasses(
    prismaGradeLevels: PrismaGradeLevelWithClasses[],
  ): GradeLevel[] {
    return prismaGradeLevels.map((g) =>
      PrismaGradeLevelMapper.toDomainWithClasses(g),
    );
  }
}
