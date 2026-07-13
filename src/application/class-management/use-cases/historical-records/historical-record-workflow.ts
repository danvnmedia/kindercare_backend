import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import {
  HISTORICAL_CORRECTION_FIELDS,
  HistoricalCorrectionField,
  HistoricalCorrectionPatch,
  HistoricalEnrollmentView,
  HistoricalRecordType,
  HistoricalSchoolYearEnrollmentView,
  buildHistoricalEnrollmentView,
  buildHistoricalSchoolYearEnrollmentView,
} from "../../historical-record-view";
import {
  HistoricalRecordRepository,
  HistoricalRetentionPolicy,
} from "../../ports/historical-record.repository";

export type HistoricalRecordResolved =
  | {
      recordType: "ENROLLMENT";
      studentId: string;
      view: HistoricalEnrollmentView;
      finalized: boolean;
    }
  | {
      recordType: "SCHOOL_YEAR_ENROLLMENT";
      studentId: string;
      view: HistoricalSchoolYearEnrollmentView;
      finalized: boolean;
    };

const ALLOWED_FIELDS = new Set<string>(HISTORICAL_CORRECTION_FIELDS);

export function parseHistoricalRecordType(value: string): HistoricalRecordType {
  const normalized = value.toUpperCase().replace(/-/g, "_");
  if (normalized === "ENROLLMENT") return "ENROLLMENT";
  if (normalized === "SCHOOL_YEAR_ENROLLMENT") {
    return "SCHOOL_YEAR_ENROLLMENT";
  }
  throw new BadRequestException("UNSUPPORTED_HISTORICAL_RECORD_TYPE");
}

export async function resolveHistoricalRecord(
  repository: HistoricalRecordRepository,
  recordType: HistoricalRecordType,
  recordId: string,
  campusId: string,
): Promise<HistoricalRecordResolved> {
  const corrections = await repository.findCorrections(recordType, recordId);

  if (recordType === "ENROLLMENT") {
    const enrollment = await repository.findEnrollmentByIdInCampus(
      recordId,
      campusId,
    );
    if (!enrollment) {
      throw new NotFoundException("HISTORICAL_RECORD_NOT_FOUND");
    }
    return {
      recordType,
      studentId: enrollment.studentId,
      view: buildHistoricalEnrollmentView(enrollment, corrections),
      finalized:
        enrollment.historicalFinalizedAt !== null ||
        enrollment.endDate !== null,
    };
  }

  const schoolYearEnrollment =
    await repository.findSchoolYearEnrollmentByIdInCampus(recordId, campusId);
  if (!schoolYearEnrollment) {
    throw new NotFoundException("HISTORICAL_RECORD_NOT_FOUND");
  }
  return {
    recordType,
    studentId: schoolYearEnrollment.studentId,
    view: buildHistoricalSchoolYearEnrollmentView(
      schoolYearEnrollment,
      0,
      corrections,
    ),
    finalized:
      schoolYearEnrollment.historicalFinalizedAt !== null ||
      schoolYearEnrollment.exitDate !== null,
  };
}

export function normalizeCorrectionPatch(
  recordType: HistoricalRecordType,
  raw: Record<string, unknown>,
): HistoricalCorrectionPatch {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new BadRequestException("CORRECTION_AFTER_VALUE_REQUIRED");
  }

  const patch: HistoricalCorrectionPatch = {};
  for (const [field, value] of Object.entries(raw)) {
    if (!ALLOWED_FIELDS.has(field)) {
      throw new BadRequestException(`UNSUPPORTED_CORRECTION_FIELD:${field}`);
    }
    if (recordType === "SCHOOL_YEAR_ENROLLMENT" && field === "className") {
      throw new BadRequestException(
        "CLASS_CORRECTION_NOT_AVAILABLE_FOR_RECORD",
      );
    }
    patch[field as HistoricalCorrectionField] = normalizeCorrectionValue(
      field as HistoricalCorrectionField,
      value,
    );
  }

  if (Object.keys(patch).length === 0) {
    throw new BadRequestException("CORRECTION_AFTER_VALUE_REQUIRED");
  }

  return patch;
}

export function flattenEffectiveSnapshot(
  view: HistoricalEnrollmentView | HistoricalSchoolYearEnrollmentView,
): HistoricalCorrectionPatch {
  return {
    studentFullName: view.effectiveSnapshot.student.fullName,
    studentCode: view.effectiveSnapshot.student.studentCode,
    studentNickname: view.effectiveSnapshot.student.nickname,
    className: view.effectiveSnapshot.class?.name ?? null,
    gradeLevelName: view.effectiveSnapshot.gradeLevel.name,
    gradeLevelOrder: view.effectiveSnapshot.gradeLevel.order,
    schoolYearName: view.effectiveSnapshot.schoolYear.name,
    schoolYearStartDate: dateOnly(view.effectiveSnapshot.schoolYear.startDate),
    schoolYearEndDate: dateOnly(view.effectiveSnapshot.schoolYear.endDate),
  };
}

export function assertRetentionPolicy(
  policy: HistoricalRetentionPolicy | null,
): HistoricalRetentionPolicy {
  if (!policy) {
    throw new ConflictException({
      code: "RETENTION_POLICY_NOT_CONFIGURED",
      message:
        "Configure a historical retention policy before archive, redaction, anonymization, or deletion.",
      action: "CONFIGURE_RETENTION_POLICY",
    });
  }
  return policy;
}

export function assertHistoricalRecordFinalized(
  resolved: HistoricalRecordResolved,
): void {
  if (!resolved.finalized) {
    throw new ConflictException("HISTORICAL_RECORD_NOT_FINALIZED");
  }
}

export function assertRetentionEligible(
  view: HistoricalEnrollmentView | HistoricalSchoolYearEnrollmentView,
  policy: HistoricalRetentionPolicy,
  action: "redaction" | "deletion",
): void {
  if (view.retentionState.legalHold) {
    throw new ConflictException({
      code: "LEGAL_HOLD_ACTIVE",
      action: "REMOVE_LEGAL_HOLD_BEFORE_RETENTION_ACTION",
    });
  }

  if (action === "redaction" && !policy.redactionAllowed) {
    throw new ConflictException({
      code: "RETENTION_REDACTION_NOT_ALLOWED",
      policySource: policy.policySource,
    });
  }
  if (action === "deletion" && !policy.deletionAllowed) {
    throw new ConflictException({
      code: "RETENTION_DELETION_NOT_ALLOWED",
      policySource: policy.policySource,
    });
  }

  if (!view.retentionState.deletionEligible) {
    throw new ConflictException({
      code: "RETENTION_PERIOD_NOT_EXPIRED",
      retentionExpiresAt: view.retentionState.retentionExpiresAt,
      policySource: policy.policySource,
    });
  }
}

export function calculateRetentionExpiry(
  finalizedAt: Date | null,
  policy: HistoricalRetentionPolicy,
): Date {
  const basis = finalizedAt ?? new Date();
  const expiry = new Date(basis);
  expiry.setUTCDate(expiry.getUTCDate() + policy.retentionDays);
  return expiry;
}

function normalizeCorrectionValue(
  field: HistoricalCorrectionField,
  value: unknown,
): string | number | null {
  if (value === null) return null;
  if (field === "gradeLevelOrder") {
    if (typeof value !== "number" || !Number.isInteger(value)) {
      throw new BadRequestException("GRADE_LEVEL_ORDER_MUST_BE_INTEGER");
    }
    return value;
  }
  if (field === "schoolYearStartDate" || field === "schoolYearEndDate") {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadRequestException("SCHOOL_YEAR_DATE_MUST_BE_DATE_ONLY");
    }
    return value;
  }
  if (typeof value !== "string") {
    throw new BadRequestException(`CORRECTION_FIELD_MUST_BE_STRING:${field}`);
  }
  return value.trim() || null;
}

function dateOnly(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}
