import { HistoricalRecordRepository } from "../../ports/historical-record.repository";
import { SchoolYearLifecycleRetentionInput } from "../../ports/school-year-lifecycle.repository";

export async function resolveSchoolYearLifecycleRetention(
  repository: HistoricalRecordRepository | undefined,
  campusId: string,
  finalizedAt: Date,
): Promise<SchoolYearLifecycleRetentionInput | undefined> {
  if (!repository) {
    return undefined;
  }
  const policy = await repository.findRetentionPolicy(campusId);
  if (!policy) {
    return undefined;
  }
  const retentionExpiresAt = new Date(finalizedAt);
  retentionExpiresAt.setUTCDate(
    retentionExpiresAt.getUTCDate() + policy.retentionDays,
  );
  return {
    retentionExpiresAt,
    retentionPolicySource: policy.policySource,
  };
}
