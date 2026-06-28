/**
 * Status of a post approval request.
 * Used to track the approval workflow state for teacher-submitted posts.
 */
export enum ApprovalStatus {
  /** Request is awaiting admin review */
  PENDING = "PENDING",
  /** Request has been approved by admin */
  APPROVED = "APPROVED",
  /** Request has been rejected by admin */
  REJECTED = "REJECTED",
}
