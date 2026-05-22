export const STUDENT_PHASES = [
  "ACTIVE",
  "WAITING",
  "DEFERRED",
  "GRADUATED",
  "WITHDRAWN",
] as const;

export type StudentPhase = (typeof STUDENT_PHASES)[number];
