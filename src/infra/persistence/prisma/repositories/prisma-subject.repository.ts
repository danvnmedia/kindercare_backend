import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { SubjectRepository } from "@/application/class-management/ports/subject.repository";
import { Subject } from "@/domain/class-management/entities/subject.entity";
import { PrismaSubjectMapper } from "../mapper/prisma-subject.mapper";

@Injectable()
export class PrismaSubjectRepository implements SubjectRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Subject | null> {
    const prismaSubject = await this.prisma.subject.findUnique({
      where: { id },
    });
    return prismaSubject ? PrismaSubjectMapper.toDomain(prismaSubject) : null;
  }

  async findByNameAndCampus(
    name: string,
    campusId: string,
  ): Promise<Subject | null> {
    const prismaSubject = await this.prisma.subject.findFirst({
      where: { name, campusId },
    });
    return prismaSubject ? PrismaSubjectMapper.toDomain(prismaSubject) : null;
  }

  async findAll(campusId: string): Promise<Subject[]> {
    const prismaSubjects = await this.prisma.subject.findMany({
      where: { campusId },
      orderBy: { name: "asc" },
    });
    return PrismaSubjectMapper.toDomainArray(prismaSubjects);
  }

  async save(subject: Subject): Promise<Subject> {
    const prismaData = PrismaSubjectMapper.toPrisma(subject);
    const created = await this.prisma.subject.create({
      data: prismaData,
    });
    return PrismaSubjectMapper.toDomain(created);
  }

  async update(subject: Subject): Promise<Subject> {
    const prismaData = PrismaSubjectMapper.toPrismaUpdate(subject);
    const updated = await this.prisma.subject.update({
      where: { id: subject.id },
      data: prismaData,
    });
    return PrismaSubjectMapper.toDomain(updated);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.subject.delete({
      where: { id },
    });
  }
}
