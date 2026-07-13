import {
  SchoolYearEnrollment as PrismaSchoolYearEnrollment,
  GradeLevel as PrismaGradeLevel,
  SchoolYear as PrismaSchoolYear,
  Student as PrismaStudent,
  Prisma,
} from "@prisma/client";
import { SchoolYearEnrollment } from "@/domain/class-management/entities/school-year-enrollment.entity";
import { ExitReason } from "@/domain/class-management/enums/exit-reason.enum";
import { EnrollmentCancellationReason } from "@/domain/class-management/enums/enrollment-cancellation-reason.enum";
import { PrismaGradeLevelMapper } from "./prisma-grade-level.mapper";
import { PrismaSchoolYearMapper } from "./prisma-school-year.mapper";
import { PrismaStudentMapper } from "./prisma-student.mapper";

type PrismaSchoolYearEnrollmentWithRelations = PrismaSchoolYearEnrollment & {
  schoolYear?: PrismaSchoolYear | null;
  gradeLevel?: PrismaGradeLevel | null;
  student?: PrismaStudent | null;
};

export class PrismaSchoolYearEnrollmentMapper {
  static toDomain(
    row: PrismaSchoolYearEnrollmentWithRelations,
  ): SchoolYearEnrollment {
    const props: any = {
      studentId: row.studentId,
      campusId: row.campusId,
      schoolYearId: row.schoolYearId,
      gradeLevelId: row.gradeLevelId,
      enrollmentDate: row.enrollmentDate,
      exitDate: row.exitDate ?? null,
      exitReason: PrismaSchoolYearEnrollmentMapper.toExitReason(row.exitReason),
      note: row.note,
      cancelledAt: row.cancelledAt,
      cancellationReason: PrismaSchoolYearEnrollmentMapper.toCancellationReason(
        row.cancellationReason,
      ),
      cancellationNote: row.cancellationNote,
      cancelledByUserId: row.cancelledByUserId,
      cancelledByFullName: row.cancelledByFullName,
      snapshotStudentFullName: row.snapshotStudentFullName,
      snapshotStudentCode: row.snapshotStudentCode,
      snapshotStudentNickname: row.snapshotStudentNickname,
      snapshotGradeLevelName: row.snapshotGradeLevelName,
      snapshotGradeLevelOrder: row.snapshotGradeLevelOrder,
      snapshotSchoolYearName: row.snapshotSchoolYearName,
      snapshotSchoolYearStartDate: row.snapshotSchoolYearStartDate,
      snapshotSchoolYearEndDate: row.snapshotSchoolYearEndDate,
      snapshotCapturedAt: row.snapshotCapturedAt,
      historicalFinalizedAt: row.historicalFinalizedAt,
      archivedAt: row.archivedAt,
      redactedAt: row.redactedAt,
      retentionExpiresAt: row.retentionExpiresAt,
      retentionPolicySource: row.retentionPolicySource,
      legalHold: row.legalHold,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };

    if (row.schoolYear) {
      props.schoolYear = PrismaSchoolYearMapper.toDomain(row.schoolYear);
    }
    if (row.gradeLevel) {
      props.gradeLevel = PrismaGradeLevelMapper.toDomain(row.gradeLevel);
    }
    if (row.student) {
      props.student = PrismaStudentMapper.toDomain(row.student);
    }

    return SchoolYearEnrollment.create(props, row.id);
  }

  static toDomainSimple(row: PrismaSchoolYearEnrollment): SchoolYearEnrollment {
    return SchoolYearEnrollment.create(
      {
        studentId: row.studentId,
        campusId: row.campusId,
        schoolYearId: row.schoolYearId,
        gradeLevelId: row.gradeLevelId,
        enrollmentDate: row.enrollmentDate,
        exitDate: row.exitDate ?? null,
        exitReason: PrismaSchoolYearEnrollmentMapper.toExitReason(
          row.exitReason,
        ),
        note: row.note,
        cancelledAt: row.cancelledAt,
        cancellationReason:
          PrismaSchoolYearEnrollmentMapper.toCancellationReason(
            row.cancellationReason,
          ),
        cancellationNote: row.cancellationNote,
        cancelledByUserId: row.cancelledByUserId,
        cancelledByFullName: row.cancelledByFullName,
        snapshotStudentFullName: row.snapshotStudentFullName,
        snapshotStudentCode: row.snapshotStudentCode,
        snapshotStudentNickname: row.snapshotStudentNickname,
        snapshotGradeLevelName: row.snapshotGradeLevelName,
        snapshotGradeLevelOrder: row.snapshotGradeLevelOrder,
        snapshotSchoolYearName: row.snapshotSchoolYearName,
        snapshotSchoolYearStartDate: row.snapshotSchoolYearStartDate,
        snapshotSchoolYearEndDate: row.snapshotSchoolYearEndDate,
        snapshotCapturedAt: row.snapshotCapturedAt,
        historicalFinalizedAt: row.historicalFinalizedAt,
        archivedAt: row.archivedAt,
        redactedAt: row.redactedAt,
        retentionExpiresAt: row.retentionExpiresAt,
        retentionPolicySource: row.retentionPolicySource,
        legalHold: row.legalHold,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
      row.id,
    );
  }

  static toPrisma(
    entity: SchoolYearEnrollment,
  ): Prisma.SchoolYearEnrollmentUncheckedCreateInput {
    return {
      id: entity.id,
      studentId: entity.studentId,
      campusId: entity.campusId,
      schoolYearId: entity.schoolYearId,
      gradeLevelId: entity.gradeLevelId,
      enrollmentDate: entity.enrollmentDate,
      exitDate: entity.exitDate,
      exitReason: entity.exitReason,
      note: entity.note,
      cancelledAt: entity.cancelledAt,
      cancellationReason: entity.cancellationReason,
      cancellationNote: entity.cancellationNote,
      cancelledByUserId: entity.cancelledByUserId,
      cancelledByFullName: entity.cancelledByFullName,
      snapshotStudentFullName: entity.snapshotStudentFullName,
      snapshotStudentCode: entity.snapshotStudentCode,
      snapshotStudentNickname: entity.snapshotStudentNickname,
      snapshotGradeLevelName: entity.snapshotGradeLevelName,
      snapshotGradeLevelOrder: entity.snapshotGradeLevelOrder,
      snapshotSchoolYearName: entity.snapshotSchoolYearName,
      snapshotSchoolYearStartDate: entity.snapshotSchoolYearStartDate,
      snapshotSchoolYearEndDate: entity.snapshotSchoolYearEndDate,
      snapshotCapturedAt: entity.snapshotCapturedAt,
      historicalFinalizedAt: entity.historicalFinalizedAt,
      archivedAt: entity.archivedAt,
      redactedAt: entity.redactedAt,
      retentionExpiresAt: entity.retentionExpiresAt,
      retentionPolicySource: entity.retentionPolicySource,
      legalHold: entity.legalHold,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  // Returns UncheckedUpdateInput to allow raw scalar updates and to ensure the
  // four immutable FKs (studentId / campusId / schoolYearId / gradeLevelId) and
  // createdAt are deliberately stripped. See
  // @doc/guides/code-generation-pattern#immutability and project memory
  // xw1paz (four-layer immutability).
  static toPrismaUpdate(
    entity: SchoolYearEnrollment,
  ): Prisma.SchoolYearEnrollmentUncheckedUpdateInput {
    return {
      enrollmentDate: entity.enrollmentDate,
      exitDate: entity.exitDate,
      exitReason: entity.exitReason,
      note: entity.note,
      cancelledAt: entity.cancelledAt,
      cancellationReason: entity.cancellationReason,
      cancellationNote: entity.cancellationNote,
      cancelledByUserId: entity.cancelledByUserId,
      cancelledByFullName: entity.cancelledByFullName,
      snapshotStudentFullName: entity.snapshotStudentFullName,
      snapshotStudentCode: entity.snapshotStudentCode,
      snapshotStudentNickname: entity.snapshotStudentNickname,
      snapshotGradeLevelName: entity.snapshotGradeLevelName,
      snapshotGradeLevelOrder: entity.snapshotGradeLevelOrder,
      snapshotSchoolYearName: entity.snapshotSchoolYearName,
      snapshotSchoolYearStartDate: entity.snapshotSchoolYearStartDate,
      snapshotSchoolYearEndDate: entity.snapshotSchoolYearEndDate,
      snapshotCapturedAt: entity.snapshotCapturedAt,
      historicalFinalizedAt: entity.historicalFinalizedAt,
      archivedAt: entity.archivedAt,
      redactedAt: entity.redactedAt,
      retentionExpiresAt: entity.retentionExpiresAt,
      retentionPolicySource: entity.retentionPolicySource,
      legalHold: entity.legalHold,
      updatedAt: entity.updatedAt,
    };
  }

  static toDomainArray(
    rows: PrismaSchoolYearEnrollmentWithRelations[],
  ): SchoolYearEnrollment[] {
    return rows.map((r) => PrismaSchoolYearEnrollmentMapper.toDomain(r));
  }

  // Mirrors the enrollment mapper: unknown or null raw values map to null
  // rather than throwing — validation lives at the wire and at the factory.
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
