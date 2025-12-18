import { GradeLevel as PrismaGradeLevel } from "@prisma/client";
import { GradeLevel } from "@/domain/class-management/entities/grade-level.entity";
import { Prisma } from "@prisma/client";

export class PrismaGradeLevelMapper {
  static toDomain(prismaGradeLevel: PrismaGradeLevel): GradeLevel {
    return GradeLevel.create(
      {
        name: prismaGradeLevel.name,
        order: prismaGradeLevel.order,
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
      createdAt: gradeLevel.createdAt,
      updatedAt: gradeLevel.updatedAt,
    };
  }

  static toPrismaUpdate(gradeLevel: GradeLevel): Prisma.GradeLevelUpdateInput {
    return {
      name: gradeLevel.name,
      order: gradeLevel.order,
      updatedAt: gradeLevel.updatedAt,
    };
  }

  static toDomainArray(prismaGradeLevels: PrismaGradeLevel[]): GradeLevel[] {
    return prismaGradeLevels.map((g) => PrismaGradeLevelMapper.toDomain(g));
  }
}
