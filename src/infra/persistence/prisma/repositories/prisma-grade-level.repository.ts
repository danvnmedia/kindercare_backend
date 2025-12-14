import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { GradeLevelRepository } from "@/application/class-management/ports/grade-level.repository";
import { GradeLevel } from "@/domain/class-management/entities/grade-level.entity";
import { PrismaGradeLevelMapper } from "../mapper/prisma-grade-level.mapper";

@Injectable()
export class PrismaGradeLevelRepository implements GradeLevelRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<GradeLevel | null> {
    const prismaGradeLevel = await this.prisma.gradeLevel.findUnique({
      where: { id },
    });
    return prismaGradeLevel ? PrismaGradeLevelMapper.toDomain(prismaGradeLevel) : null;
  }

  async findByName(name: string): Promise<GradeLevel | null> {
    const prismaGradeLevel = await this.prisma.gradeLevel.findFirst({
      where: { name },
    });
    return prismaGradeLevel ? PrismaGradeLevelMapper.toDomain(prismaGradeLevel) : null;
  }

  async findAll(): Promise<GradeLevel[]> {
    const prismaGradeLevels = await this.prisma.gradeLevel.findMany({
      orderBy: { order: "asc" },
    });
    return PrismaGradeLevelMapper.toDomainArray(prismaGradeLevels);
  }

  async save(gradeLevel: GradeLevel): Promise<GradeLevel> {
    const prismaData = PrismaGradeLevelMapper.toPrisma(gradeLevel);
    const created = await this.prisma.gradeLevel.create({
      data: prismaData,
    });
    return PrismaGradeLevelMapper.toDomain(created);
  }

  async update(gradeLevel: GradeLevel): Promise<GradeLevel> {
    const prismaData = PrismaGradeLevelMapper.toPrismaUpdate(gradeLevel);
    const updated = await this.prisma.gradeLevel.update({
      where: { id: gradeLevel.id },
      data: prismaData,
    });
    return PrismaGradeLevelMapper.toDomain(updated);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.gradeLevel.delete({
      where: { id },
    });
  }
}
