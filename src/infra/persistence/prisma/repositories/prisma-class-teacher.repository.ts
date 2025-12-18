import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { ClassTeacherRepository } from "@/application/class-management/ports/class-teacher.repository";
import { ClassTeacher } from "@/domain/class-management/entities/class-teacher.entity";
import { PrismaClassTeacherMapper } from "../mapper/prisma-class-teacher.mapper";

@Injectable()
export class PrismaClassTeacherRepository implements ClassTeacherRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByCompositeKey(
    classId: string,
    teacherId: string,
    subjectId: string,
  ): Promise<ClassTeacher | null> {
    const prismaClassTeacher = await this.prisma.classTeacher.findUnique({
      where: {
        classId_teacherId_subjectId: {
          classId,
          teacherId,
          subjectId,
        },
      },
      include: {
        class: true,
        teacher: true,
        subject: true,
      },
    });
    return prismaClassTeacher
      ? PrismaClassTeacherMapper.toDomain(prismaClassTeacher)
      : null;
  }

  async findByClassId(classId: string): Promise<ClassTeacher[]> {
    const prismaClassTeachers = await this.prisma.classTeacher.findMany({
      where: { classId },
      include: {
        class: true,
        teacher: true,
        subject: true,
      },
    });
    return PrismaClassTeacherMapper.toDomainArray(prismaClassTeachers);
  }

  async findByTeacherId(teacherId: string): Promise<ClassTeacher[]> {
    const prismaClassTeachers = await this.prisma.classTeacher.findMany({
      where: { teacherId },
      include: {
        class: true,
        teacher: true,
        subject: true,
      },
    });
    return PrismaClassTeacherMapper.toDomainArray(prismaClassTeachers);
  }

  async findBySubjectId(subjectId: string): Promise<ClassTeacher[]> {
    const prismaClassTeachers = await this.prisma.classTeacher.findMany({
      where: { subjectId },
      include: {
        class: true,
        teacher: true,
        subject: true,
      },
    });
    return PrismaClassTeacherMapper.toDomainArray(prismaClassTeachers);
  }

  async findByClassAndSubject(
    classId: string,
    subjectId: string,
  ): Promise<ClassTeacher[]> {
    const prismaClassTeachers = await this.prisma.classTeacher.findMany({
      where: { classId, subjectId },
      include: {
        class: true,
        teacher: true,
        subject: true,
      },
    });
    return PrismaClassTeacherMapper.toDomainArray(prismaClassTeachers);
  }

  async save(classTeacher: ClassTeacher): Promise<ClassTeacher> {
    const prismaData = PrismaClassTeacherMapper.toPrisma(classTeacher);
    const created = await this.prisma.classTeacher.create({
      data: prismaData,
      include: {
        class: true,
        teacher: true,
        subject: true,
      },
    });
    return PrismaClassTeacherMapper.toDomain(created);
  }

  async delete(
    classId: string,
    teacherId: string,
    subjectId: string,
  ): Promise<void> {
    await this.prisma.classTeacher.delete({
      where: {
        classId_teacherId_subjectId: {
          classId,
          teacherId,
          subjectId,
        },
      },
    });
  }

  async deleteByClassId(classId: string): Promise<void> {
    await this.prisma.classTeacher.deleteMany({
      where: { classId },
    });
  }

  async deleteByTeacherId(teacherId: string): Promise<void> {
    await this.prisma.classTeacher.deleteMany({
      where: { teacherId },
    });
  }
}
