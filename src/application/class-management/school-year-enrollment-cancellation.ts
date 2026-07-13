import { Enrollment } from "@/domain/class-management/entities/enrollment.entity";
import { SchoolYearEnrollment } from "@/domain/class-management/entities/school-year-enrollment.entity";
import { EnrollmentCancellationReason } from "@/domain/class-management/enums/enrollment-cancellation-reason.enum";
import { EnrollmentEffectiveStatus } from "@/domain/class-management/enums/enrollment-effective-status.enum";

export const SchoolYearEnrollmentCancellationErrorCode = {
  ENROLLMENT_ALREADY_EFFECTIVE: "ENROLLMENT_ALREADY_EFFECTIVE",
  ENROLLMENT_ALREADY_CLOSED: "ENROLLMENT_ALREADY_CLOSED",
  CANCELLATION_CHILD_STATE_CONFLICT: "CANCELLATION_CHILD_STATE_CONFLICT",
  ENROLLMENT_CANCELLATION_CONCURRENT_MODIFICATION:
    "ENROLLMENT_CANCELLATION_CONCURRENT_MODIFICATION",
} as const;

export interface CancelSchoolYearEnrollmentInput {
  id: string;
  campusId: string;
  cancellationReason: EnrollmentCancellationReason;
  note?: string | null;
}

export interface CancelSchoolYearEnrollmentResult {
  resultStatus: typeof EnrollmentEffectiveStatus.CANCELLED;
  parent: SchoolYearEnrollment;
  affectedChildren: Enrollment[];
  affectedChildIds: string[];
  affectedChildCount: number;
  idempotentReplay: boolean;
}
