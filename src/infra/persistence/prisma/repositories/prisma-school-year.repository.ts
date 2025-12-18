import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { SchoolYearRepository } from "@/application/class-management/ports/school-year.repository";
import { SchoolYear } from "@/domain/class-management/entities/school-year.entity";
import { PrismaSchoolYearMapper } from "../mapper/prisma-school-year.mapper";

@Injectable()
export class PrismaSchoolYearRepository implements SchoolYearRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<SchoolYear | null> {
    const prismaSchoolYear = await this.prisma.schoolYear.findUnique({
      where: { id },
    });
    return prismaSchoolYear
      ? PrismaSchoolYearMapper.toDomain(prismaSchoolYear)
      : null;
  }

  async findByName(name: string): Promise<SchoolYear | null> {
    const prismaSchoolYear = await this.prisma.schoolYear.findFirst({
      where: { name },
    });
    return prismaSchoolYear
      ? PrismaSchoolYearMapper.toDomain(prismaSchoolYear)
      : null;
  }

  async findActive(): Promise<SchoolYear | null> {
    const prismaSchoolYear = await this.prisma.schoolYear.findFirst({
      where: { status: true },
    });
    return prismaSchoolYear
      ? PrismaSchoolYearMapper.toDomain(prismaSchoolYear)
      : null;
  }

  async findAll(): Promise<SchoolYear[]> {
    const prismaSchoolYears = await this.prisma.schoolYear.findMany({
      orderBy: { startDate: "desc" },
    });
    return PrismaSchoolYearMapper.toDomainArray(prismaSchoolYears);
  }

  async save(schoolYear: SchoolYear): Promise<SchoolYear> {
    const prismaData = PrismaSchoolYearMapper.toPrisma(schoolYear);
    const created = await this.prisma.schoolYear.create({
      data: prismaData,
    });
    return PrismaSchoolYearMapper.toDomain(created);
  }

  async update(schoolYear: SchoolYear): Promise<SchoolYear> {
    const prismaData = PrismaSchoolYearMapper.toPrismaUpdate(schoolYear);
    const updated = await this.prisma.schoolYear.update({
      where: { id: schoolYear.id },
      data: prismaData,
    });
    return PrismaSchoolYearMapper.toDomain(updated);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.schoolYear.delete({
      where: { id },
    });
  }

  async setActive(id: string): Promise<SchoolYear> {
    // Deactivate all school years and activate the specified one in a transaction
    const [_, updated] = await this.prisma.$transaction([
      this.prisma.schoolYear.updateMany({
        where: { status: true },
        data: { status: false },
      }),
      this.prisma.schoolYear.update({
        where: { id },
        data: { status: true },
      }),
    ]);
    return PrismaSchoolYearMapper.toDomain(updated);
  }
}
