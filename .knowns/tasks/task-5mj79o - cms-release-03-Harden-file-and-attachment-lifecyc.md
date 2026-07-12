---
id: 5mj79o
title: "[cms-release-03] Harden file and attachment lifecycle"
status: done
priority: high
labels:
  - from-spec
  - cms
  - upload
  - security
createdAt: '2026-07-12T03:37:33.374Z'
updatedAt: '2026-07-12T05:32:45.488Z'
timeSpent: 2438
spec: specs/2026-07-11-cms-api-contract-alignment
fulfills:
  - AC-11
  - AC-12
  - AC-13
---
# [cms-release-03] Harden file and attachment lifecycle

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Resolve embedded attachment URLs, protect attached files, separate owner/elevated deletion, and make completion/cleanup state transitions race-safe.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every embedded post attachment returns a usable read URL
- [x] #2 Owners can delete eligible files; elevated delete-any is distinct; attached files are protected
- [x] #3 Completion and stale cleanup use atomic status claims
- [x] #4 Regression tests and build pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add response URL hydration at post boundary. 2. Correct delete authorization and attachment reference guard. 3. Add conditional file status transitions for completion/cleanup. 4. Add regression tests and build.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented: post-controller response interceptor hydrates signed attachment URLs across detail/list/transition/batch/direct attachment payloads with per-response key deduplication. File deletion now keeps file.delete owner-scoped, adds file.manage elevated delete-any, and checks attachment references under a file row lock before soft delete. Upload completion uses PENDING-to-UPLOADED compare-and-set with idempotent URL recovery; stale cleanup atomically claims stale PENDING rows as ERROR before storage deletion. No schema migration. Verification: 9 targeted suites, 114 tests passed; npm run build passed; touched-file ESLint passed; git diff --check passed; task validation passed.
Review follow-up: address cleanup retry, concurrent completion idempotency, bounded URL signing; document permission rollout and signer-failure contract.
Review P2 remediation: cleanup now retries stale ERROR rows using updatedAt as an atomic worker lease, then soft-deletes records only after storage cleanup; failed/crashed attempts become eligible after the stale interval. Completion CAS losers re-read and return idempotent success for UPLOADED/PROCESSED, otherwise 409 Conflict. Attachment signing retains per-response deduplication, caps concurrency at 8, and fails closed with 503 ServiceUnavailableException. Deployment note: seed file.manage in each environment, then explicitly assign it only to intended elevated roles; no speculative role assignment included. Response-signing occurs after controller work, so mutation responses can return 503 after persistence committed; clients must refresh state before retrying.
Verification after review remediation: 9 targeted suites / 66 tests passed; touched-file ESLint passed; npm run build passed; git diff --check passed; task validation passed. Canonical docs unchanged by this follow-up.
Reopened: fence cleanup finalization to lease token; distinguish finalization outcomes; preserve non-signer serialization errors.
Final review remediation: cleanup claim returns exact updatedAt lease token; finalization condition includes that token, fencing expired workers after reclaim. Cleanup metrics now separate storage deletion, finalized records, lease conflicts, and persistence failures; cron logs expose each outcome. Attachment interceptor catches only signed-URL rejection, preserving serialization errors. Tests added for reclaim fencing, false finalization, finalization DB failure, and serialization classification. Verification: 9 targeted suites / 70 tests passed; touched-file ESLint passed; npm run build passed; git diff --check passed; task validation passed.
Reopened: integrated review P1 remediation for campus-scoped file delete-any authority and explicit cross-campus/global-role regressions.
Integrated review P1 remediation: file delete-any now uses global-only isGlobalAdmin bypass; otherwise requires campus-applicable file.manage. Added campus A system-role plus campus B file.delete regression and global system-role control. Verification: 5 related suites / 62 tests passed; touched-file ESLint passed with pre-existing module-type warning; npm run build passed; scoped git diff --check passed; task validation passed. Canonical docs unchanged.
<!-- SECTION:NOTES:END -->

