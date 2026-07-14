import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { EnrollmentRepository } from "@/application/class-management/ports/enrollment.repository";
import { AppTransactionClient } from "@/application/ports/transaction-runner.port";
import { Enrollment } from "@/domain/class-management/entities/enrollment.entity";
import { PrismaEnrollmentMapper } from "../mapper/prisma-enrollment.mapper";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";
import { PrismaQueryService } from "@/core/modules/standard-response/services/prisma-query.service";
import { toUtcDateOnly } from "@/domain/class-management/enrollment-effective-status";
import { EnrollmentEffectiveStatusFilter } from "@/application/class-management/enrollment-effective-status-filter";

@Injectable()
export class PrismaEnrollmentRepository implements EnrollmentRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queryService: PrismaQueryService,
  ) {}

  async findById(id: string): Promise<Enrollment | null> {
    const prismaEnrollment = await this.prisma.enrollment.findUnique({
      where: { id },
      include: {
        class: { include: { schoolYear: true, gradeLevel: true } },
        student: true,
      },
    });
    return prismaEnrollment
      ? PrismaEnrollmentMapper.toDomain(prismaEnrollment)
      : null;
  }

  async findByStudentClassDate(
    studentId: string,
    classId: string,
    enrollmentDate: Date,
  ): Promise<Enrollment | null> {
    const prismaEnrollment = await this.prisma.enrollment.findFirst({
      where: {
        studentId,
        classId,
        enrollmentDate,
        cancelledAt: null,
      },
      include: {
        class: { include: { schoolYear: true, gradeLevel: true } },
        student: true,
      },
    });
    return prismaEnrollment
      ? PrismaEnrollmentMapper.toDomain(prismaEnrollment)
      : null;
  }

  async findEffectiveByStudentIdAt(
    studentId: string,
    effectiveDate: Date,
  ): Promise<Enrollment | null> {
    const date = toUtcDateOnly(effectiveDate);
    const row = await this.prisma.enrollment.findFirst({
      where: {
        studentId,
        cancelledAt: null,
        enrollmentDate: { lte: date },
        OR: [{ endDate: null }, { endDate: { gte: date } }],
      },
      include: {
        class: { include: { schoolYear: true, gradeLevel: true } },
        student: true,
      },
      orderBy: [{ enrollmentDate: "desc" }, { id: "desc" }],
    });
    return row ? PrismaEnrollmentMapper.toDomain(row) : null;
  }

  async findUpcomingByStudentId(
    studentId: string,
    referenceDate: Date,
  ): Promise<Enrollment[]> {
    const rows = await this.prisma.enrollment.findMany({
      where: {
        studentId,
        cancelledAt: null,
        enrollmentDate: { gt: toUtcDateOnly(referenceDate) },
      },
      include: {
        class: { include: { schoolYear: true, gradeLevel: true } },
        student: true,
      },
      orderBy: [{ enrollmentDate: "asc" }, { id: "asc" }],
    });
    return PrismaEnrollmentMapper.toDomainArray(rows);
  }

  async findStructurallyOpenByStudentId(
    studentId: string,
  ): Promise<Enrollment | null> {
    const row = await this.prisma.enrollment.findFirst({
      where: { studentId, endDate: null, cancelledAt: null },
      include: {
        class: { include: { schoolYear: true, gradeLevel: true } },
        student: true,
      },
      orderBy: [{ enrollmentDate: "desc" }, { id: "desc" }],
    });
    return row ? PrismaEnrollmentMapper.toDomain(row) : null;
  }

  async findOverlappingByStudentId(
    studentId: string,
    enrollmentDate: Date,
    endDate: Date | null = null,
    excludeEnrollmentId?: string,
  ): Promise<Enrollment | null> {
    const start = toUtcDateOnly(enrollmentDate);
    const proposedEnd = endDate ? toUtcDateOnly(endDate) : null;
    const row = await this.prisma.enrollment.findFirst({
      where: {
        studentId,
        cancelledAt: null,
        ...(excludeEnrollmentId ? { id: { not: excludeEnrollmentId } } : {}),
        ...(proposedEnd ? { enrollmentDate: { lte: proposedEnd } } : {}),
        OR: [{ endDate: null }, { endDate: { gte: start } }],
      },
      include: {
        class: { include: { schoolYear: true, gradeLevel: true } },
        student: true,
      },
      orderBy: [{ enrollmentDate: "asc" }, { id: "asc" }],
    });
    return row ? PrismaEnrollmentMapper.toDomain(row) : null;
  }

  async findBySchoolYearEnrollmentId(
    schoolYearEnrollmentId: string,
  ): Promise<Enrollment[]> {
    const rows = await this.prisma.enrollment.findMany({
      where: { schoolYearEnrollmentId },
      include: {
        class: { include: { schoolYear: true, gradeLevel: true } },
        student: true,
      },
      orderBy: [{ enrollmentDate: "asc" }, { id: "asc" }],
    });
    return PrismaEnrollmentMapper.toDomainArray(rows);
  }

  async findByClassId(classId: string): Promise<Enrollment[]> {
    const prismaEnrollments = await this.prisma.enrollment.findMany({
      where: { classId },
      include: {
        class: { include: { schoolYear: true, gradeLevel: true } },
        student: true,
      },
      orderBy: { enrollmentDate: "desc" },
    });
    return PrismaEnrollmentMapper.toDomainArray(prismaEnrollments);
  }

  async findByStudentId(studentId: string): Promise<Enrollment[]> {
    const prismaEnrollments = await this.prisma.enrollment.findMany({
      where: { studentId },
      include: {
        class: { include: { schoolYear: true, gradeLevel: true } },
        student: true,
      },
      orderBy: { enrollmentDate: "desc" },
    });
    return PrismaEnrollmentMapper.toDomainArray(prismaEnrollments);
  }

  async findActiveByStudentId(studentId: string): Promise<Enrollment | null> {
    return this.findStructurallyOpenByStudentId(studentId);
  }

  async findByClassIdAndEffectiveStatus(
    classId: string,
    effectiveStatus: EnrollmentEffectiveStatusFilter,
    referenceDate: Date,
  ): Promise<Enrollment[]> {
    const referenceDay = toUtcDateOnly(referenceDate);
    const statusWhere: Prisma.EnrollmentWhereInput =
      effectiveStatus === EnrollmentEffectiveStatusFilter.ALL
        ? {}
        : effectiveStatus === EnrollmentEffectiveStatusFilter.CANCELLED
          ? { cancelledAt: { not: null } }
          : effectiveStatus === EnrollmentEffectiveStatusFilter.UPCOMING
            ? {
                cancelledAt: null,
                enrollmentDate: { gt: referenceDay },
              }
            : effectiveStatus === EnrollmentEffectiveStatusFilter.CLOSED
              ? {
                  cancelledAt: null,
                  endDate: { lt: referenceDay },
                }
              : {
                  cancelledAt: null,
                  enrollmentDate: { lte: referenceDay },
                  OR: [{ endDate: null }, { endDate: { gte: referenceDay } }],
                };
    const prismaEnrollments = await this.prisma.enrollment.findMany({
      where: { classId, ...statusWhere },
      include: {
        class: { include: { schoolYear: true, gradeLevel: true } },
        student: true,
      },
      orderBy: [{ enrollmentDate: "desc" }, { id: "desc" }],
    });
    return PrismaEnrollmentMapper.toDomainArray(prismaEnrollments);
  }

  async findActiveByClassIdOnDate(
    classId: string,
    date: Date,
  ): Promise<Enrollment[]> {
    const dateOnly = toUtcDateOnly(date);
    const prismaEnrollments = await this.prisma.enrollment.findMany({
      where: {
        classId,
        cancelledAt: null,
        enrollmentDate: { lte: dateOnly },
        OR: [{ endDate: null }, { endDate: { gte: dateOnly } }],
        student: { isArchived: false },
      },
      include: {
        class: { include: { schoolYear: true, gradeLevel: true } },
        student: true,
      },
      orderBy: [{ enrollmentDate: "desc" }, { id: "desc" }],
    });
    return PrismaEnrollmentMapper.toDomainArray(prismaEnrollments);
  }

  async findAllByStudentId(studentId: string): Promise<Enrollment[]> {
    const prismaEnrollments = await this.prisma.enrollment.findMany({
      where: { studentId },
      include: {
        class: {
          include: {
            schoolYear: true,
            gradeLevel: true,
          },
        },
        student: true,
      },
      orderBy: { enrollmentDate: "desc" },
    });
    return PrismaEnrollmentMapper.toDomainArray(prismaEnrollments);
  }

  async findAll(params: StandardRequest): Promise<PaginatedResult<Enrollment>> {
    params.allowedFilterFields = ["classId", "studentId", "enrollmentDate"];
    params.allowedSortFields = ["createdAt", "updatedAt", "enrollmentDate"];

    return await this.queryService.executeQuery<Enrollment>(
      this.prisma,
      "enrollment",
      params,
      {
        include: {
          class: { include: { schoolYear: true, gradeLevel: true } },
          student: true,
        },
      },
      PrismaEnrollmentMapper,
    );
  }

  async save(
    enrollment: Enrollment,
    tx?: AppTransactionClient,
  ): Promise<Enrollment> {
    const exec = async (client: AppTransactionClient): Promise<Enrollment> => {
      await this.lockAndValidateParentCoverage(client, enrollment);
      const prismaData = PrismaEnrollmentMapper.toPrisma(enrollment);
      const created = await client.enrollment.create({
        data: prismaData,
        include: {
          class: { include: { schoolYear: true, gradeLevel: true } },
          student: true,
        },
      });
      return PrismaEnrollmentMapper.toDomain(created);
    };
    return tx ? exec(tx) : this.prisma.$transaction(exec);
  }

  async saveMany(enrollments: Enrollment[]): Promise<Enrollment[]> {
    return this.prisma.$transaction(async (tx) => {
      const results: Enrollment[] = [];
      for (const enrollment of enrollments) {
        await this.lockAndValidateParentCoverage(tx, enrollment);
        const created = await tx.enrollment.create({
          data: PrismaEnrollmentMapper.toPrisma(enrollment),
          include: {
            class: { include: { schoolYear: true, gradeLevel: true } },
            student: true,
          },
        });
        results.push(PrismaEnrollmentMapper.toDomain(created));
      }
      return results;
    });
  }

  async update(
    enrollment: Enrollment,
    tx?: AppTransactionClient,
  ): Promise<Enrollment> {
    const client = tx ?? this.prisma;
    const prismaData = PrismaEnrollmentMapper.toPrismaUpdate(enrollment);
    const updated = await client.enrollment.update({
      where: { id: enrollment.id },
      data: prismaData,
      include: {
        class: { include: { schoolYear: true, gradeLevel: true } },
        student: true,
      },
    });
    return PrismaEnrollmentMapper.toDomain(updated);
  }

  async transferEnrollment(
    closed: Enrollment,
    opened: Enrollment,
    tx?: AppTransactionClient,
  ): Promise<{ closed: Enrollment; opened: Enrollment }> {
    const exec = async (
      client: AppTransactionClient,
    ): Promise<{ closed: Enrollment; opened: Enrollment }> => {
      await this.lockAndValidateParentCoverage(client, opened);
      const updatedRow = await client.enrollment.update({
        where: { id: closed.id },
        data: PrismaEnrollmentMapper.toPrismaUpdate(closed),
        include: {
          class: { include: { schoolYear: true, gradeLevel: true } },
          student: true,
        },
      });
      const createdRow = await client.enrollment.create({
        data: PrismaEnrollmentMapper.toPrisma(opened),
        include: {
          class: { include: { schoolYear: true, gradeLevel: true } },
          student: true,
        },
      });
      return {
        closed: PrismaEnrollmentMapper.toDomain(updatedRow),
        opened: PrismaEnrollmentMapper.toDomain(createdRow),
      };
    };
    // Caller-supplied tx wins: skip the inner $transaction so both writes
    // land on the outer audit-emit tx (D4 same-tx atomicity).
    return tx ? exec(tx) : this.prisma.$transaction(exec);
  }

  private async lockAndValidateParentCoverage(
    client: AppTransactionClient,
    enrollment: Enrollment,
  ): Promise<void> {
    const effectiveDate = toUtcDateOnly(enrollment.enrollmentDate);
    const rows = await client.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT id
      FROM school_year_enrollment
      WHERE id = ${enrollment.schoolYearEnrollmentId}::uuid
        AND cancelled_at IS NULL
        AND enrollment_date <= ${effectiveDate}
        AND (exit_date IS NULL OR exit_date >= ${effectiveDate})
      FOR SHARE
    `);
    if (rows.length !== 1) {
      throw new Error("NO_SCHOOL_YEAR_ENROLLMENT");
    }
  }
}
