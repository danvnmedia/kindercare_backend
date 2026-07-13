import { ExitReason } from "@/domain/class-management/enums/exit-reason.enum";

export enum EnrollmentReadinessMode {
  ENROLL = "ENROLL",
  TRANSFER = "TRANSFER",
}

export enum EnrollmentReadinessState {
  READY = "READY",
  BLOCKED = "BLOCKED",
}

export interface EnrollmentReadinessStudentInput {
  studentId: string;
  fromClassId?: string;
}

export interface EnrollmentReadinessClassContext {
  id: string;
  name: string;
}

export interface EnrollmentReadinessGradeContext {
  id: string;
  name: string;
  order?: number;
}

export interface EnrollmentReadinessSchoolYearContext {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
}

export interface EnrollmentReadinessParentContext {
  id: string;
  gradeLevelId: string;
  gradeLevel?: EnrollmentReadinessGradeContext | null;
  enrollmentDate: Date;
  exitDate: Date | null;
  exitReason: ExitReason | null;
}

export interface EnrollmentReadinessEnrollmentContext {
  id: string;
  classId: string;
  class?: EnrollmentReadinessClassContext | null;
  enrollmentDate: Date;
  endDate: Date | null;
  exitReason: ExitReason | null;
}

export interface EnrollmentReadinessContext {
  requestedDate: Date;
  targetClass: EnrollmentReadinessClassContext;
  targetGradeLevel: EnrollmentReadinessGradeContext | null;
  targetSchoolYear: EnrollmentReadinessSchoolYearContext | null;
  schoolYearEnrollment?: EnrollmentReadinessParentContext | null;
  activeEnrollment?: EnrollmentReadinessEnrollmentContext | null;
  conflictingEnrollment?: EnrollmentReadinessEnrollmentContext | null;
}

export interface EnrollmentReadinessRow {
  studentId: string;
  state: EnrollmentReadinessState;
  reason?: string;
  message?: string;
  context: EnrollmentReadinessContext;
}
