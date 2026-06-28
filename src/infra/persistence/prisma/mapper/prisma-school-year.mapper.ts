import { SchoolYear as PrismaSchoolYear } from "@prisma/client";
import { SchoolYear } from "@/domain/class-management/entities/school-year.entity";
import { Prisma } from "@prisma/client";

export class PrismaSchoolYearMapper {
  static toDomain(prismaSchoolYear: PrismaSchoolYear): SchoolYear {
    return SchoolYear.create(
      {
        name: prismaSchoolYear.name,
        startDate: prismaSchoolYear.startDate,
        endDate: prismaSchoolYear.endDate,
        isArchived: prismaSchoolYear.isArchived,
        campusId: prismaSchoolYear.campusId,
        createdAt: prismaSchoolYear.createdAt,
        updatedAt: prismaSchoolYear.updatedAt,
      },
      prismaSchoolYear.id,
    );
  }

  static toPrisma(
    schoolYear: SchoolYear,
  ): Prisma.SchoolYearUncheckedCreateInput {
    return {
      id: schoolYear.id,
      name: schoolYear.name,
      startDate: schoolYear.startDate,
      endDate: schoolYear.endDate,
      isArchived: schoolYear.isArchived,
      campusId: schoolYear.campusId,
      createdAt: schoolYear.createdAt,
      updatedAt: schoolYear.updatedAt,
    };
  }

  static toPrismaUpdate(schoolYear: SchoolYear): Prisma.SchoolYearUpdateInput {
    return {
      name: schoolYear.name,
      startDate: schoolYear.startDate,
      endDate: schoolYear.endDate,
      isArchived: schoolYear.isArchived,
      updatedAt: schoolYear.updatedAt,
    };
  }

  static toDomainArray(prismaSchoolYears: PrismaSchoolYear[]): SchoolYear[] {
    return prismaSchoolYears.map((s) => PrismaSchoolYearMapper.toDomain(s));
  }
}
