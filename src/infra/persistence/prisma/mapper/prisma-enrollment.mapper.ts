import {
  Enrollment as PrismaEnrollment,
  Class as PrismaClass,
  GradeLevel as PrismaGradeLevel,
  SchoolYear as PrismaSchoolYear,
  Student as PrismaStudent,
} from "@prisma/client";
import { Enrollment } from "@/domain/class-management/entities/enrollment.entity";
import { ExitReason } from "@/domain/class-management/enums/exit-reason.enum";
import { EnrollmentCancellationReason } from "@/domain/class-management/enums/enrollment-cancellation-reason.enum";
import { Prisma } from "@prisma/client";
import { PrismaClassMapper } from "./prisma-class.mapper";
import { PrismaStudentMapper } from "./prisma-student.mapper";

type PrismaClassWithNested = PrismaClass & {
  gradeLevel?: PrismaGradeLevel | null;
  schoolYear?: PrismaSchoolYear | null;
};

type PrismaEnrollmentWithRelations = PrismaEnrollment & {
  class?: PrismaClassWithNested | null;
  student?: PrismaStudent | null;
};

export class PrismaEnrollmentMapper {
  static toDomain(prismaEnrollment: PrismaEnrollmentWithRelations): Enrollment {
    const props: any = {
      classId: prismaEnrollment.classId,
      studentId: prismaEnrollment.studentId,
      schoolYearEnrollmentId: prismaEnrollment.schoolYearEnrollmentId,
      enrollmentDate: prismaEnrollment.enrollmentDate,
      endDate: prismaEnrollment.endDate ?? null,
      exitReason: PrismaEnrollmentMapper.toExitReason(
        prismaEnrollment.exitReason,
      ),
      note: prismaEnrollment.note,
      cancelledAt: prismaEnrollment.cancelledAt,
      cancellationReason: PrismaEnrollmentMapper.toCancellationReason(
        prismaEnrollment.cancellationReason,
      ),
      cancellationNote: prismaEnrollment.cancellationNote,
      cancelledByUserId: prismaEnrollment.cancelledByUserId,
      cancelledByFullName: prismaEnrollment.cancelledByFullName,
      snapshotStudentFullName: prismaEnrollment.snapshotStudentFullName,
      snapshotStudentCode: prismaEnrollment.snapshotStudentCode,
      snapshotStudentNickname: prismaEnrollment.snapshotStudentNickname,
      snapshotClassName: prismaEnrollment.snapshotClassName,
      snapshotGradeLevelName: prismaEnrollment.snapshotGradeLevelName,
      snapshotGradeLevelOrder: prismaEnrollment.snapshotGradeLevelOrder,
      snapshotSchoolYearName: prismaEnrollment.snapshotSchoolYearName,
      snapshotSchoolYearStartDate: prismaEnrollment.snapshotSchoolYearStartDate,
      snapshotSchoolYearEndDate: prismaEnrollment.snapshotSchoolYearEndDate,
      snapshotCapturedAt: prismaEnrollment.snapshotCapturedAt,
      historicalFinalizedAt: prismaEnrollment.historicalFinalizedAt,
      archivedAt: prismaEnrollment.archivedAt,
      redactedAt: prismaEnrollment.redactedAt,
      retentionExpiresAt: prismaEnrollment.retentionExpiresAt,
      retentionPolicySource: prismaEnrollment.retentionPolicySource,
      legalHold: prismaEnrollment.legalHold,
      createdAt: prismaEnrollment.createdAt,
      updatedAt: prismaEnrollment.updatedAt,
    };

    // Use the rich `toDomain` so nested `gradeLevel`/`schoolYear` propagate
    // when the Prisma query includes them (e.g. `findAllByStudentId`).
    // For queries that only `include: { class: true }`, the nested fields
    // stay `undefined` — `PrismaClassMapper.toDomain` no-ops them.
    if (prismaEnrollment.class) {
      props.class = PrismaClassMapper.toDomain(prismaEnrollment.class);
    }
    if (prismaEnrollment.student) {
      props.student = PrismaStudentMapper.toDomain(prismaEnrollment.student);
    }

    return Enrollment.create(props, prismaEnrollment.id);
  }

  static toDomainSimple(prismaEnrollment: PrismaEnrollment): Enrollment {
    return Enrollment.create(
      {
        classId: prismaEnrollment.classId,
        studentId: prismaEnrollment.studentId,
        schoolYearEnrollmentId: prismaEnrollment.schoolYearEnrollmentId,
        enrollmentDate: prismaEnrollment.enrollmentDate,
        endDate: prismaEnrollment.endDate ?? null,
        exitReason: PrismaEnrollmentMapper.toExitReason(
          prismaEnrollment.exitReason,
        ),
        note: prismaEnrollment.note,
        cancelledAt: prismaEnrollment.cancelledAt,
        cancellationReason: PrismaEnrollmentMapper.toCancellationReason(
          prismaEnrollment.cancellationReason,
        ),
        cancellationNote: prismaEnrollment.cancellationNote,
        cancelledByUserId: prismaEnrollment.cancelledByUserId,
        cancelledByFullName: prismaEnrollment.cancelledByFullName,
        snapshotStudentFullName: prismaEnrollment.snapshotStudentFullName,
        snapshotStudentCode: prismaEnrollment.snapshotStudentCode,
        snapshotStudentNickname: prismaEnrollment.snapshotStudentNickname,
        snapshotClassName: prismaEnrollment.snapshotClassName,
        snapshotGradeLevelName: prismaEnrollment.snapshotGradeLevelName,
        snapshotGradeLevelOrder: prismaEnrollment.snapshotGradeLevelOrder,
        snapshotSchoolYearName: prismaEnrollment.snapshotSchoolYearName,
        snapshotSchoolYearStartDate:
          prismaEnrollment.snapshotSchoolYearStartDate,
        snapshotSchoolYearEndDate: prismaEnrollment.snapshotSchoolYearEndDate,
        snapshotCapturedAt: prismaEnrollment.snapshotCapturedAt,
        historicalFinalizedAt: prismaEnrollment.historicalFinalizedAt,
        archivedAt: prismaEnrollment.archivedAt,
        redactedAt: prismaEnrollment.redactedAt,
        retentionExpiresAt: prismaEnrollment.retentionExpiresAt,
        retentionPolicySource: prismaEnrollment.retentionPolicySource,
        legalHold: prismaEnrollment.legalHold,
        createdAt: prismaEnrollment.createdAt,
        updatedAt: prismaEnrollment.updatedAt,
      },
      prismaEnrollment.id,
    );
  }

  static toPrisma(
    enrollment: Enrollment,
  ): Prisma.EnrollmentUncheckedCreateInput {
    return {
      id: enrollment.id,
      classId: enrollment.classId,
      studentId: enrollment.studentId,
      schoolYearEnrollmentId: enrollment.schoolYearEnrollmentId,
      enrollmentDate: enrollment.enrollmentDate,
      endDate: enrollment.endDate,
      exitReason: enrollment.exitReason,
      note: enrollment.note,
      cancelledAt: enrollment.cancelledAt,
      cancellationReason: enrollment.cancellationReason,
      cancellationNote: enrollment.cancellationNote,
      cancelledByUserId: enrollment.cancelledByUserId,
      cancelledByFullName: enrollment.cancelledByFullName,
      snapshotStudentFullName: enrollment.snapshotStudentFullName,
      snapshotStudentCode: enrollment.snapshotStudentCode,
      snapshotStudentNickname: enrollment.snapshotStudentNickname,
      snapshotClassName: enrollment.snapshotClassName,
      snapshotGradeLevelName: enrollment.snapshotGradeLevelName,
      snapshotGradeLevelOrder: enrollment.snapshotGradeLevelOrder,
      snapshotSchoolYearName: enrollment.snapshotSchoolYearName,
      snapshotSchoolYearStartDate: enrollment.snapshotSchoolYearStartDate,
      snapshotSchoolYearEndDate: enrollment.snapshotSchoolYearEndDate,
      snapshotCapturedAt: enrollment.snapshotCapturedAt,
      historicalFinalizedAt: enrollment.historicalFinalizedAt,
      archivedAt: enrollment.archivedAt,
      redactedAt: enrollment.redactedAt,
      retentionExpiresAt: enrollment.retentionExpiresAt,
      retentionPolicySource: enrollment.retentionPolicySource,
      legalHold: enrollment.legalHold,
      createdAt: enrollment.createdAt,
      updatedAt: enrollment.updatedAt,
    };
  }

  static toPrismaUpdate(enrollment: Enrollment): Prisma.EnrollmentUpdateInput {
    return {
      enrollmentDate: enrollment.enrollmentDate,
      endDate: enrollment.endDate,
      exitReason: enrollment.exitReason,
      note: enrollment.note,
      cancelledAt: enrollment.cancelledAt,
      cancellationReason: enrollment.cancellationReason,
      cancellationNote: enrollment.cancellationNote,
      cancelledByUserId: enrollment.cancelledByUserId,
      cancelledByFullName: enrollment.cancelledByFullName,
      snapshotStudentFullName: enrollment.snapshotStudentFullName,
      snapshotStudentCode: enrollment.snapshotStudentCode,
      snapshotStudentNickname: enrollment.snapshotStudentNickname,
      snapshotClassName: enrollment.snapshotClassName,
      snapshotGradeLevelName: enrollment.snapshotGradeLevelName,
      snapshotGradeLevelOrder: enrollment.snapshotGradeLevelOrder,
      snapshotSchoolYearName: enrollment.snapshotSchoolYearName,
      snapshotSchoolYearStartDate: enrollment.snapshotSchoolYearStartDate,
      snapshotSchoolYearEndDate: enrollment.snapshotSchoolYearEndDate,
      snapshotCapturedAt: enrollment.snapshotCapturedAt,
      historicalFinalizedAt: enrollment.historicalFinalizedAt,
      archivedAt: enrollment.archivedAt,
      redactedAt: enrollment.redactedAt,
      retentionExpiresAt: enrollment.retentionExpiresAt,
      retentionPolicySource: enrollment.retentionPolicySource,
      legalHold: enrollment.legalHold,
      updatedAt: enrollment.updatedAt,
    };
  }

  static toDomainArray(
    prismaEnrollments: PrismaEnrollmentWithRelations[],
  ): Enrollment[] {
    return prismaEnrollments.map((e) => PrismaEnrollmentMapper.toDomain(e));
  }

  /**
   * Coerces a raw Prisma string column into the ExitReason domain enum.
   * Unknown or null values map to null so we do not invent invariants the DB
   * never enforced. Validation happens at the wire and at Enrollment.create.
   */
  private static toExitReason(value: string | null): ExitReason | null {
    if (value === null) return null;
    return (Object.values(ExitReason) as string[]).includes(value)
      ? (value as ExitReason)
      : null;
  }

  private static toCancellationReason(
    value: string | null,
  ): EnrollmentCancellationReason | null {
    if (value === null) return null;
    return (Object.values(EnrollmentCancellationReason) as string[]).includes(
      value,
    )
      ? (value as EnrollmentCancellationReason)
      : null;
  }
}
