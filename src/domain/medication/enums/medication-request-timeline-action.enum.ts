export enum MedicationRequestTimelineAction {
  SUBMITTED = "SUBMITTED",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  NEEDS_MORE_INFO = "NEEDS_MORE_INFO",
  CANCELLED = "CANCELLED",
  PARENT_RESPONDED = "PARENT_RESPONDED",
}

export enum MedicationRequestTimelineActorType {
  GUARDIAN = "GUARDIAN",
  STAFF = "STAFF",
  SYSTEM = "SYSTEM",
}
