import { AppTransactionClient } from "@/application/ports/transaction-runner.port";
import { Enrollment } from "@/domain/class-management/entities/enrollment.entity";
import { SchoolYearEnrollment } from "@/domain/class-management/entities/school-year-enrollment.entity";

export interface EnrollmentCancellationLifecycleResult {
  noLongerEligibleCandidateIds: string[];
  invalidatedPreviewIds: string[];
}

/** Persistence seam used only by the atomic future-registration cancellation. */
export abstract class EnrollmentCancellationRepository {
  abstract findParentById(
    id: string,
    tx?: AppTransactionClient,
  ): Promise<SchoolYearEnrollment | null>;

  abstract findChildrenByParentId(
    schoolYearEnrollmentId: string,
    tx?: AppTransactionClient,
  ): Promise<Enrollment[]>;

  /**
   * CAS update: succeeds only while the uncancelled parent is still UPCOMING
   * at `referenceDate`. A null result means the caller must refetch/classify.
   */
  abstract cancelParentIfUpcoming(
    parent: SchoolYearEnrollment,
    referenceDate: Date,
    tx: AppTransactionClient,
  ): Promise<SchoolYearEnrollment | null>;

  abstract cancelChildrenIfUpcoming(
    children: Enrollment[],
    referenceDate: Date,
    tx: AppTransactionClient,
  ): Promise<Enrollment[] | null>;

  abstract reconcileLifecycle(
    input: {
      schoolYearEnrollmentId: string;
      campusId: string;
      cancelledAt: Date;
      retention?: {
        retentionExpiresAt: Date;
        retentionPolicySource: string;
      };
    },
    tx: AppTransactionClient,
  ): Promise<EnrollmentCancellationLifecycleResult>;
}
