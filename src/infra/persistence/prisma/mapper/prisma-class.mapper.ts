import {
  Class as PrismaClass,
  GradeLevel as PrismaGradeLevel,
  SchoolYear as PrismaSchoolYear,
} from "@prisma/client";
import { Class } from "@/domain/class-management/entities/class.entity";
import { Prisma } from "@prisma/client";
import { PrismaGradeLevelMapper } from "./prisma-grade-level.mapper";
import { PrismaSchoolYearMapper } from "./prisma-school-year.mapper";

type PrismaClassWithRelations = PrismaClass & {
  gradeLevel?: PrismaGradeLevel | null;
  schoolYear?: PrismaSchoolYear | null;
};

export class PrismaClassMapper {
  static toDomain(prismaClass: PrismaClassWithRelations): Class {
    const classProps: any = {
      name: prismaClass.name,
      description: prismaClass.description,
      gradeLevelId: prismaClass.gradeLevelId,
      schoolYearId: prismaClass.schoolYearId,
      createdAt: prismaClass.createdAt,
      updatedAt: prismaClass.updatedAt,
    };

    // Map relations if they exist
    if (prismaClass.gradeLevel) {
      classProps.gradeLevel = PrismaGradeLevelMapper.toDomain(
        prismaClass.gradeLevel,
      );
    }
    if (prismaClass.schoolYear) {
      classProps.schoolYear = PrismaSchoolYearMapper.toDomain(
        prismaClass.schoolYear,
      );
    }

    return Class.create(classProps, prismaClass.id);
  }

  static toDomainSimple(prismaClass: PrismaClass): Class {
    return Class.create(
      {
        name: prismaClass.name,
        description: prismaClass.description,
        gradeLevelId: prismaClass.gradeLevelId,
        schoolYearId: prismaClass.schoolYearId,
        createdAt: prismaClass.createdAt,
        updatedAt: prismaClass.updatedAt,
      },
      prismaClass.id,
    );
  }

  static toPrisma(classEntity: Class): Prisma.ClassUncheckedCreateInput {
    return {
      id: classEntity.id,
      name: classEntity.name,
      description: classEntity.description,
      gradeLevelId: classEntity.gradeLevelId,
      schoolYearId: classEntity.schoolYearId,
      createdAt: classEntity.createdAt,
      updatedAt: classEntity.updatedAt,
    };
  }

  static toPrismaUpdate(classEntity: Class): Prisma.ClassUpdateInput {
    return {
      name: classEntity.name,
      description: classEntity.description,
      updatedAt: classEntity.updatedAt,
    };
  }

  static toDomainArray(prismaClasses: PrismaClassWithRelations[]): Class[] {
    return prismaClasses.map((c) => PrismaClassMapper.toDomain(c));
  }
}
