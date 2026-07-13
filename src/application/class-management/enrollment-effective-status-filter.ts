import { EnrollmentEffectiveStatus } from "@/domain/class-management/enums/enrollment-effective-status.enum";

export enum EnrollmentEffectiveStatusFilter {
  ACTIVE = EnrollmentEffectiveStatus.ACTIVE,
  UPCOMING = EnrollmentEffectiveStatus.UPCOMING,
  CLOSED = EnrollmentEffectiveStatus.CLOSED,
  CANCELLED = EnrollmentEffectiveStatus.CANCELLED,
  ALL = "ALL",
}
