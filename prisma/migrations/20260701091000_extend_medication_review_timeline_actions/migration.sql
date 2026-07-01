-- ============================================================================
-- Migration: extend_medication_review_timeline_actions
-- ============================================================================
-- Allows staff review actions to be recorded in medication request timeline.
-- ============================================================================

ALTER TABLE "medication_request_timeline_entry"
    DROP CONSTRAINT "med_request_timeline_action_check";

ALTER TABLE "medication_request_timeline_entry"
    ADD CONSTRAINT "med_request_timeline_action_check"
    CHECK (
        "action" IN (
            'SUBMITTED',
            'APPROVED',
            'REJECTED',
            'NEEDS_MORE_INFO',
            'CANCELLED',
            'PARENT_RESPONDED'
        )
    );
