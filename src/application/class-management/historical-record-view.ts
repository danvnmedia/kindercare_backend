import { Enrollment } from "@/domain/class-management/entities/enrollment.entity";
import { SchoolYearEnrollment } from "@/domain/class-management/entities/school-year-enrollment.entity";
import { ExitReason } from "@/domain/class-management/enums/exit-reason.enum";
import { EnrollmentCancellationReason } from "@/domain/class-management/enums/enrollment-cancellation-reason.enum";
import { EnrollmentEffectiveStatus } from "@/domain/class-management/enums/enrollment-effective-status.enum";

export const HISTORICAL_CORRECTION_FIELDS = [
  "studentFullName",
  "studentCode",
  "studentNickname",
  "className",
  "gradeLevelName",
  "gradeLevelOrder",
  "schoolYearName",
  "schoolYearStartDate",
  "schoolYearEndDate",
] as const;

export type HistoricalCorrectionField =
  (typeof HISTORICAL_CORRECTION_FIELDS)[number];

export type HistoricalCorrectionPatch = Partial<
  Record<HistoricalCorrectionField, string | number | Date | null>
>;

export type HistoricalRecordType = "ENROLLMENT" | "SCHOOL_YEAR_ENROLLMENT";

export type SnapshotSource = "SNAPSHOT" | "CURRENT_FALLBACK" | "MISSING";

export interface HistoricalSnapshotAvailability {
  student: SnapshotSource;
  class: SnapshotSource;
  gradeLevel: SnapshotSource;
  schoolYear: SnapshotSource;
}

export interface HistoricalStudentSnapshot {
  fullName: string | null;
  studentCode: string | null;
  nickname: string | null;
}

export interface HistoricalClassSnapshot {
  name: string | null;
}

export interface HistoricalGradeLevelSnapshot {
  name: string | null;
  order: number | null;
}

export interface HistoricalSchoolYearSnapshot {
  name: string | null;
  startDate: Date | null;
  endDate: Date | null;
}

export interface HistoricalSnapshotView {
  student: HistoricalStudentSnapshot;
  class: HistoricalClassSnapshot | null;
  gradeLevel: HistoricalGradeLevelSnapshot;
  schoolYear: HistoricalSchoolYearSnapshot;
}

export interface HistoricalRetentionStateView {
  archived: boolean;
  archivedAt: Date | null;
  redacted: boolean;
  redactedAt: Date | null;
  retentionExpiresAt: Date | null;
  retentionPolicySource: string | null;
  policyConfigured: boolean;
  deletionEligible: boolean;
  legalHold: boolean;
}

export interface HistoricalCorrectionSummary {
  appliedCount: number;
  lastCorrectedAt: Date | null;
}

export interface HistoricalCorrectionEventLike {
  afterValue: HistoricalCorrectionPatch;
  createdAt: Date;
}

export interface HistoricalEnrollmentView {
  id: string;
  classId: string;
  studentId: string;
  schoolYearEnrollmentId: string;
  enrollmentDate: Date;
  endDate: Date | null;
  exitReason: ExitReason | null;
  note: string | null;
  effectiveStatus: EnrollmentEffectiveStatus;
  cancelledAt: Date | null;
  cancellationReason: EnrollmentCancellationReason | null;
  cancellationNote: string | null;
  cancelledBy: { id: string; fullName: string | null } | null;
  class?: {
    id: string;
    name: string;
    schoolYear?: { id: string; name: string } | null;
    gradeLevel?: { id: string; name: string; order: number } | null;
  };
  student?: {
    id: string;
    fullName: string;
    nickname: string | null;
    studentCode: string | null;
  };
  snapshot: HistoricalSnapshotView;
  effectiveSnapshot: HistoricalSnapshotView;
  snapshotAvailability: HistoricalSnapshotAvailability;
  correctionSummary: HistoricalCorrectionSummary;
  retentionState: HistoricalRetentionStateView;
  createdAt: Date;
  updatedAt: Date;
}

export interface HistoricalSchoolYearEnrollmentView {
  id: string;
  studentId: string;
  campusId: string;
  schoolYearId: string;
  gradeLevelId: string;
  enrollmentDate: Date;
  exitDate: Date | null;
  exitReason: ExitReason | null;
  note: string | null;
  effectiveStatus: EnrollmentEffectiveStatus;
  cancelledAt: Date | null;
  cancellationReason: EnrollmentCancellationReason | null;
  cancellationNote: string | null;
  cancelledBy: { id: string; fullName: string | null } | null;
  schoolYear: {
    id: string;
    name: string;
    startDate: Date;
    endDate: Date;
  } | null;
  gradeLevel: {
    id: string;
    name: string;
    order: number;
  } | null;
  student?: {
    id: string;
    fullName: string;
    nickname: string | null;
    studentCode: string | null;
  };
  childEnrollmentCount: number;
  snapshot: HistoricalSnapshotView;
  effectiveSnapshot: HistoricalSnapshotView;
  snapshotAvailability: HistoricalSnapshotAvailability;
  correctionSummary: HistoricalCorrectionSummary;
  retentionState: HistoricalRetentionStateView;
  createdAt: Date;
  updatedAt: Date;
}

export function buildHistoricalEnrollmentView(
  enrollment: Enrollment,
  corrections: HistoricalCorrectionEventLike[] = [],
  referenceDate: Date = new Date(),
): HistoricalEnrollmentView {
  const snapshot: HistoricalSnapshotView = {
    student: {
      fullName:
        enrollment.snapshotStudentFullName ??
        enrollment.student?.fullName ??
        null,
      studentCode:
        enrollment.snapshotStudentCode ??
        enrollment.student?.studentCode ??
        null,
      nickname:
        enrollment.snapshotStudentNickname ??
        enrollment.student?.nickname ??
        null,
    },
    class: {
      name: enrollment.snapshotClassName ?? enrollment.class?.name ?? null,
    },
    gradeLevel: {
      name:
        enrollment.snapshotGradeLevelName ??
        enrollment.class?.gradeLevel?.name ??
        null,
      order:
        enrollment.snapshotGradeLevelOrder ??
        enrollment.class?.gradeLevel?.order ??
        null,
    },
    schoolYear: {
      name:
        enrollment.snapshotSchoolYearName ??
        enrollment.class?.schoolYear?.name ??
        null,
      startDate:
        enrollment.snapshotSchoolYearStartDate ??
        enrollment.class?.schoolYear?.startDate ??
        null,
      endDate:
        enrollment.snapshotSchoolYearEndDate ??
        enrollment.class?.schoolYear?.endDate ??
        null,
    },
  };

  return {
    id: enrollment.id,
    classId: enrollment.classId,
    studentId: enrollment.studentId,
    schoolYearEnrollmentId: enrollment.schoolYearEnrollmentId,
    enrollmentDate: enrollment.enrollmentDate,
    endDate: enrollment.endDate,
    exitReason: enrollment.exitReason,
    note: enrollment.note,
    effectiveStatus: enrollment.getEffectiveStatus(referenceDate),
    cancelledAt: enrollment.cancelledAt,
    cancellationReason: enrollment.cancellationReason,
    cancellationNote: enrollment.cancellationNote,
    cancelledBy: enrollment.cancelledByUserId
      ? {
          id: enrollment.cancelledByUserId,
          fullName: enrollment.cancelledByFullName,
        }
      : null,
    class: enrollment.class
      ? {
          id: enrollment.class.id,
          name: enrollment.class.name,
          schoolYear: enrollment.class.schoolYear
            ? {
                id: enrollment.class.schoolYear.id,
                name: enrollment.class.schoolYear.name,
              }
            : null,
          gradeLevel: enrollment.class.gradeLevel
            ? {
                id: enrollment.class.gradeLevel.id,
                name: enrollment.class.gradeLevel.name,
                order: enrollment.class.gradeLevel.order,
              }
            : null,
        }
      : undefined,
    student: enrollment.student
      ? {
          id: enrollment.student.id,
          fullName: enrollment.student.fullName,
          nickname: enrollment.student.nickname,
          studentCode: enrollment.student.studentCode,
        }
      : undefined,
    snapshot,
    effectiveSnapshot: applyCorrections(snapshot, corrections),
    snapshotAvailability: {
      student: sourceFor(
        hasAny(
          enrollment.snapshotStudentFullName,
          enrollment.snapshotStudentCode,
          enrollment.snapshotStudentNickname,
        ),
        enrollment.student !== undefined,
      ),
      class: sourceFor(
        hasAny(enrollment.snapshotClassName),
        !!enrollment.class,
      ),
      gradeLevel: sourceFor(
        hasAny(
          enrollment.snapshotGradeLevelName,
          enrollment.snapshotGradeLevelOrder,
        ),
        !!enrollment.class?.gradeLevel,
      ),
      schoolYear: sourceFor(
        hasAny(
          enrollment.snapshotSchoolYearName,
          enrollment.snapshotSchoolYearStartDate,
          enrollment.snapshotSchoolYearEndDate,
        ),
        !!enrollment.class?.schoolYear,
      ),
    },
    correctionSummary: correctionSummary(corrections),
    retentionState: buildRetentionState(enrollment),
    createdAt: enrollment.createdAt,
    updatedAt: enrollment.updatedAt,
  };
}

export function buildHistoricalSchoolYearEnrollmentView(
  enrollment: SchoolYearEnrollment,
  childEnrollmentCount: number,
  corrections: HistoricalCorrectionEventLike[] = [],
  referenceDate: Date = new Date(),
): HistoricalSchoolYearEnrollmentView {
  const snapshot: HistoricalSnapshotView = {
    student: {
      fullName:
        enrollment.snapshotStudentFullName ??
        enrollment.student?.fullName ??
        null,
      studentCode:
        enrollment.snapshotStudentCode ??
        enrollment.student?.studentCode ??
        null,
      nickname:
        enrollment.snapshotStudentNickname ??
        enrollment.student?.nickname ??
        null,
    },
    class: null,
    gradeLevel: {
      name:
        enrollment.snapshotGradeLevelName ??
        enrollment.gradeLevel?.name ??
        null,
      order:
        enrollment.snapshotGradeLevelOrder ??
        enrollment.gradeLevel?.order ??
        null,
    },
    schoolYear: {
      name:
        enrollment.snapshotSchoolYearName ??
        enrollment.schoolYear?.name ??
        null,
      startDate:
        enrollment.snapshotSchoolYearStartDate ??
        enrollment.schoolYear?.startDate ??
        null,
      endDate:
        enrollment.snapshotSchoolYearEndDate ??
        enrollment.schoolYear?.endDate ??
        null,
    },
  };

  return {
    id: enrollment.id,
    studentId: enrollment.studentId,
    campusId: enrollment.campusId,
    schoolYearId: enrollment.schoolYearId,
    gradeLevelId: enrollment.gradeLevelId,
    enrollmentDate: enrollment.enrollmentDate,
    exitDate: enrollment.exitDate,
    exitReason: enrollment.exitReason,
    note: enrollment.note,
    effectiveStatus: enrollment.getEffectiveStatus(referenceDate),
    cancelledAt: enrollment.cancelledAt,
    cancellationReason: enrollment.cancellationReason,
    cancellationNote: enrollment.cancellationNote,
    cancelledBy: enrollment.cancelledByUserId
      ? {
          id: enrollment.cancelledByUserId,
          fullName: enrollment.cancelledByFullName,
        }
      : null,
    schoolYear: enrollment.schoolYear
      ? {
          id: enrollment.schoolYear.id,
          name: enrollment.schoolYear.name,
          startDate: enrollment.schoolYear.startDate,
          endDate: enrollment.schoolYear.endDate,
        }
      : null,
    gradeLevel: enrollment.gradeLevel
      ? {
          id: enrollment.gradeLevel.id,
          name: enrollment.gradeLevel.name,
          order: enrollment.gradeLevel.order,
        }
      : null,
    student: enrollment.student
      ? {
          id: enrollment.student.id,
          fullName: enrollment.student.fullName,
          nickname: enrollment.student.nickname,
          studentCode: enrollment.student.studentCode,
        }
      : undefined,
    childEnrollmentCount,
    snapshot,
    effectiveSnapshot: applyCorrections(snapshot, corrections),
    snapshotAvailability: {
      student: sourceFor(
        hasAny(
          enrollment.snapshotStudentFullName,
          enrollment.snapshotStudentCode,
          enrollment.snapshotStudentNickname,
        ),
        enrollment.student !== undefined,
      ),
      class: "MISSING",
      gradeLevel: sourceFor(
        hasAny(
          enrollment.snapshotGradeLevelName,
          enrollment.snapshotGradeLevelOrder,
        ),
        !!enrollment.gradeLevel,
      ),
      schoolYear: sourceFor(
        hasAny(
          enrollment.snapshotSchoolYearName,
          enrollment.snapshotSchoolYearStartDate,
          enrollment.snapshotSchoolYearEndDate,
        ),
        !!enrollment.schoolYear,
      ),
    },
    correctionSummary: correctionSummary(corrections),
    retentionState: buildRetentionState(enrollment),
    createdAt: enrollment.createdAt,
    updatedAt: enrollment.updatedAt,
  };
}

export function applyCorrections(
  snapshot: HistoricalSnapshotView,
  corrections: HistoricalCorrectionEventLike[],
): HistoricalSnapshotView {
  const effective: HistoricalSnapshotView = {
    student: { ...snapshot.student },
    class: snapshot.class ? { ...snapshot.class } : null,
    gradeLevel: { ...snapshot.gradeLevel },
    schoolYear: { ...snapshot.schoolYear },
  };

  for (const correction of [...corrections].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  )) {
    const patch = correction.afterValue;
    if (patch.studentFullName !== undefined) {
      effective.student.fullName = asNullableString(patch.studentFullName);
    }
    if (patch.studentCode !== undefined) {
      effective.student.studentCode = asNullableString(patch.studentCode);
    }
    if (patch.studentNickname !== undefined) {
      effective.student.nickname = asNullableString(patch.studentNickname);
    }
    if (patch.className !== undefined && effective.class) {
      effective.class.name = asNullableString(patch.className);
    }
    if (patch.gradeLevelName !== undefined) {
      effective.gradeLevel.name = asNullableString(patch.gradeLevelName);
    }
    if (patch.gradeLevelOrder !== undefined) {
      effective.gradeLevel.order =
        typeof patch.gradeLevelOrder === "number"
          ? patch.gradeLevelOrder
          : null;
    }
    if (patch.schoolYearName !== undefined) {
      effective.schoolYear.name = asNullableString(patch.schoolYearName);
    }
    if (patch.schoolYearStartDate !== undefined) {
      effective.schoolYear.startDate = asNullableDate(
        patch.schoolYearStartDate,
      );
    }
    if (patch.schoolYearEndDate !== undefined) {
      effective.schoolYear.endDate = asNullableDate(patch.schoolYearEndDate);
    }
  }

  return effective;
}

function buildRetentionState(record: {
  archivedAt: Date | null;
  redactedAt: Date | null;
  retentionExpiresAt: Date | null;
  retentionPolicySource: string | null;
  legalHold: boolean;
}): HistoricalRetentionStateView {
  const now = new Date();
  return {
    archived: record.archivedAt !== null,
    archivedAt: record.archivedAt,
    redacted: record.redactedAt !== null,
    redactedAt: record.redactedAt,
    retentionExpiresAt: record.retentionExpiresAt,
    retentionPolicySource: record.retentionPolicySource,
    policyConfigured: record.retentionPolicySource !== null,
    deletionEligible:
      record.retentionExpiresAt !== null &&
      record.retentionExpiresAt.getTime() <= now.getTime() &&
      !record.legalHold,
    legalHold: record.legalHold,
  };
}

function correctionSummary(
  corrections: HistoricalCorrectionEventLike[],
): HistoricalCorrectionSummary {
  const last = [...corrections].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  )[0];
  return {
    appliedCount: corrections.length,
    lastCorrectedAt: last?.createdAt ?? null,
  };
}

function sourceFor(hasSnapshot: boolean, hasFallback: boolean): SnapshotSource {
  if (hasSnapshot) return "SNAPSHOT";
  if (hasFallback) return "CURRENT_FALLBACK";
  return "MISSING";
}

function hasAny(...values: unknown[]): boolean {
  return values.some((value) => value !== null && value !== undefined);
}

function asNullableString(value: string | number | Date | null): string | null {
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function asNullableDate(value: string | number | Date | null): Date | null {
  if (value === null) return null;
  if (value instanceof Date) return value;
  return new Date(value);
}
