export const STUDENT_PHASES = [
  "ACTIVE",
  "WAITING",
  "DEFERRED",
  "COMPLETED",
  "GRADUATED",
  "WITHDRAWN",
] as const;

export type StudentPhase = (typeof STUDENT_PHASES)[number];
