import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { SchoolYearEnrollmentRepository } from "@/application/class-management/ports/school-year-enrollment.repository";
import { SchoolYearEnrollment } from "@/domain/class-management/entities/school-year-enrollment.entity";
import { Enrollment } from "@/domain/class-management/entities/enrollment.entity";
import { PrismaSchoolYearEnrollmentMapper } from "../mapper/prisma-school-year-enrollment.mapper";
import { PrismaEnrollmentMapper } from "../mapper/prisma-enrollment.mapper";

@Injectable()
export class PrismaSchoolYearEnrollmentRepository
  implements SchoolYearEnrollmentRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<SchoolYearEnrollment | null> {
    const row = await this.prisma.schoolYearEnrollment.findUnique({
      where: { id },
      include: {
        student: true,
        schoolYear: true,
        gradeLevel: true,
      },
    });
    return row ? PrismaSchoolYearEnrollmentMapper.toDomain(row) : null;
  }

  async findOpenByStudentAndSchoolYear(
    studentId: string,
    schoolYearId: string,
  ): Promise<SchoolYearEnrollment | null> {
    const row = await this.prisma.schoolYearEnrollment.findFirst({
      where: { studentId, schoolYearId, exitDate: null },
      include: {
        student: true,
        schoolYear: true,
        gradeLevel: true,
      },
    });
    return row ? PrismaSchoolYearEnrollmentMapper.toDomain(row) : null;
  }

  async findAllByStudentId(
    studentId: string,
  ): Promise<SchoolYearEnrollment[]> {
    const rows = await this.prisma.schoolYearEnrollment.findMany({
      where: { studentId },
      include: {
        student: true,
        schoolYear: true,
        gradeLevel: true,
      },
      orderBy: { enrollmentDate: "desc" },
    });
    return PrismaSchoolYearEnrollmentMapper.toDomainArray(rows);
  }

  async findAllByStudentIdWithChildCount(
    studentId: string,
  ): Promise<
    Array<{ enrollment: SchoolYearEnrollment; childEnrollmentCount: number }>
  > {
    const rows = await this.prisma.schoolYearEnrollment.findMany({
      where: { studentId },
      include: {
        student: true,
        schoolYear: true,
        gradeLevel: true,
        _count: { select: { enrollments: true } },
      },
      orderBy: { enrollmentDate: "desc" },
    });
    return rows.map((row) => ({
      enrollment: PrismaSchoolYearEnrollmentMapper.toDomain(row),
      childEnrollmentCount: row._count.enrollments,
    }));
  }

  async save(
    entity: SchoolYearEnrollment,
  ): Promise<SchoolYearEnrollment> {
    const created = await this.prisma.schoolYearEnrollment.create({
      data: PrismaSchoolYearEnrollmentMapper.toPrisma(entity),
      include: {
        student: true,
        schoolYear: true,
        gradeLevel: true,
      },
    });
    return PrismaSchoolYearEnrollmentMapper.toDomain(created);
  }

  async update(
    entity: SchoolYearEnrollment,
  ): Promise<SchoolYearEnrollment> {
    const updated = await this.prisma.schoolYearEnrollment.update({
      where: { id: entity.id },
      data: PrismaSchoolYearEnrollmentMapper.toPrismaUpdate(entity),
      include: {
        student: true,
        schoolYear: true,
        gradeLevel: true,
      },
    });
    return PrismaSchoolYearEnrollmentMapper.toDomain(updated);
  }

  // Single $transaction wrapping the parent close and the optional child
  // close. Prisma rolls back both on any error inside the callback — see
  // specs/school-year-enrollment-model D4 / AC-7 / AC-8.
  async withdrawWithChildren(
    parent: SchoolYearEnrollment,
    openChild: Enrollment | null,
  ): Promise<{
    closedParent: SchoolYearEnrollment;
    closedChild: Enrollment | null;
  }> {
    return this.prisma.$transaction(async (tx) => {
      const parentRow = await tx.schoolYearEnrollment.update({
        where: { id: parent.id },
        data: PrismaSchoolYearEnrollmentMapper.toPrismaUpdate(parent),
        include: {
          student: true,
          schoolYear: true,
          gradeLevel: true,
        },
      });
      const closedParent =
        PrismaSchoolYearEnrollmentMapper.toDomain(parentRow);

      let closedChild: Enrollment | null = null;
      if (openChild) {
        const childRow = await tx.enrollment.update({
          where: { id: openChild.id },
          data: PrismaEnrollmentMapper.toPrismaUpdate(openChild),
          include: { class: true, student: true },
        });
        closedChild = PrismaEnrollmentMapper.toDomain(childRow);
      }

      return { closedParent, closedChild };
    });
  }
}
