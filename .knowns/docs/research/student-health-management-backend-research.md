---
title: Student Health Management Backend Research
description: Backend research notes for planned Student Health Management, parent medical requests, enrollment health intake, and student health history continuity.
createdAt: '2026-06-30T09:52:17.342Z'
updatedAt: '2026-06-30T09:52:17.342Z'
tags:
  - research
  - student-health
  - medical-requests
  - parent-request
  - backend-spec
  - campus
---

# Student Health Management Backend Research

## Purpose

This research captures what the backend currently appears to support for the planned Student Health Management feature, and where backend investigation or decisions are still needed.

The frontend concept includes student health information collected during enrollment, ongoing health history per student, and parent-submitted medical requests such as instructions for teachers/staff to administer medication. The user also called out that medical history should remain meaningful when a student changes class, grade, or campus.

This document intentionally avoids backend implementation code. It records existing backend patterns, likely reusable areas, missing backend capabilities, and questions the backend team should answer before producing an implementation spec.

## Executive Summary

- No dedicated health, medical, allergy, medication, intake, prescription, or nurse domain was found in the current backend codebase. This should be treated as a new backend feature area, not a small extension of an existing health module.
- The closest reusable backend pattern is the existing Absence Request vertical slice: parent creates a request for a linked child, backend resolves the guardian from the authenticated user, staff list/review requests with campus permissions, and the feature has domain/use-case/repository/controller coverage.
- Parent access is already modeled through Guardian APIs and repository methods. These can likely support frontend campus selection and child selection without exposing forged guardian IDs from the client.
- Student records are campus-scoped today, with current class/phase derived from enrollment data. The requirement that health history follows a student through campus changes needs a backend identity/data ownership decision.
- File upload infrastructure exists, but health attachments introduce stricter requirements around file validation, privacy, permissions, and retention. Existing upload code has an explicit validation TODO.
- Public enrollment health intake links appear to be a new security surface. No production-style public token/invitation/form-link pattern was found in the backend codebase.
- RBAC currently includes `absence_request` permissions but no health or medical permission module. Backend will need to decide permission names, staff roles, and seed behavior.

## Frontend Feature Intent To Support

The frontend is planning around three related surfaces:

1. Student medical information/profile
   - Used to view and maintain a student's baseline health information.
   - Likely shown to authorized school staff and parents/guardians where permitted.
   - Needs to remain useful across class moves and, if supported by backend policy, campus moves.

2. Parent medical request/instruction
   - Parent selects a campus and linked student.
   - Parent submits instructions such as medication name, dosage, schedule/timing, date range, notes, and optional attachments.
   - Staff reviews, approves/denies, and potentially tracks administration/completion depending on V1 scope.

3. Enrollment health intake link
   - During enrollment, parent receives or opens a link to submit the student's health information.
   - This may need to work before the parent has the same authenticated app context, depending on enrollment flow.
   - This should be handled carefully because it may expose sensitive student information through a tokenized link.

## Existing Backend Capabilities Observed

### Parent/Guardian Access

Existing parent-facing patterns are available and should be reused conceptually:

- `GET /guardians/me/campuses` returns active campuses associated with the authenticated guardian user.
- `GET /guardians/me/students` returns active students for the authenticated guardian in the selected campus.
- The backend pattern resolves the guardian using the authenticated user and selected campus. The client should not send a trusted `guardianId` or `userId` for parent actions.
- Relevant code anchors:
  - `src/infra/http/controllers/user-management/guardian.controller.ts`
  - `src/application/user-management/ports/guardian.repository.ts`
  - `src/infra/persistence/prisma/repositories/prisma-guardian.repository.ts`

### Absence Request Vertical Slice

Absence Request is the best backend reference for a medical instruction/request workflow:

- Parent creates request for a linked student.
- Parent can list their own requests.
- Staff can list, filter, read, and review requests with campus permissions.
- The use case verifies the parent/guardian relationship server-side.
- Staff review is status-based and stores reviewer metadata.
- Repository supports campus scoping, status filtering, date overlap checks, and newest-first parent history.
- Tests already cover forged guardian identity, unlinked student rejection, overlap conflicts, parent guard metadata, staff permissions, and repository scope.
- Relevant code anchors:
  - `src/infra/http/controllers/absence-request.controller.ts`
  - `src/application/absence-request/use-cases/create-absence-request.use-case.ts`
  - `src/application/absence-request/use-cases/guardian-resolution.ts`
  - `src/domain/absence-request/entities/absence-request.entity.ts`
  - `src/infra/persistence/prisma/repositories/prisma-absence-request.repository.ts`
  - `src/infra/http/dtos/absence-request/`

### Student, Class, And Enrollment Context

Student data already has useful context for the frontend:

- Student listing/detail APIs are campus-scoped.
- `StudentWithPhase` provides current phase and current class snapshot.
- Enrollment use cases support class transfer within a school year and enrollment history lookup.
- Existing student responses include campus ID, student code, full name, DOB, gender, archived state, phase, current class, timestamps, and optional guardians.
- Relevant code anchors:
  - `src/infra/http/controllers/user-management/student.controller.ts`
  - `src/infra/http/dtos/user-management/student/student.response.ts`
  - `src/infra/persistence/prisma/repositories/prisma-student.repository.ts`
  - `src/application/class-management/use-cases/enrollment/transfer-student.use-case.ts`
  - `src/application/class-management/use-cases/enrollment/get-student-enrollment-history.use-case.ts`

### File Management

Existing file infrastructure may support medical attachments after policy decisions:

- Upload uses a two-step flow: initiate upload, upload to signed URL, then mark complete.
- Files are campus-scoped.
- File retrieval and delete are campus-scoped.
- Existing upload use case contains a TODO around MIME/size validation.
- Relevant code anchors:
  - `src/infra/http/controllers/file.controller.ts`
  - `src/application/file-management/use-cases/upload-file.use-case.ts`
  - `src/application/file-management/use-cases/complete-upload.use-case.ts`
  - `src/infra/persistence/prisma/repositories/prisma-file.repository.ts`

### Permissions And Audit

Current backend has established RBAC and audit patterns:

- `absence_request` exists as a permission module.
- No health/medical permission module was found.
- Audit trail docs describe append-only history and current-user actor plumbing.
- Existing permission seeding should be reviewed before adding health permissions.
- Relevant code anchors:
  - `src/domain/rbac/entities/permission.entity.ts`
  - `src/application/rbac/use-cases/seed-permissions.use-case.ts`
  - `architecture/audit-trail-soft-delete-patterns`

## Major Backend Gaps For This Feature

### Health Domain Model

Backend likely needs new concepts for one or more of the following:

- Student health profile or medical information record.
- Allergy, chronic condition, restriction, emergency note, and care instruction fields.
- Parent medical request or medication instruction record.
- Staff review state and reviewer metadata.
- Optional administration log if staff must record that medication was actually given.
- Health history/timeline if updates must be auditable over time.
- Attachment relationship between health records/requests and uploaded files.

Backend should decide whether these are separate models or one cohesive feature area.

### Cross-Campus Health Continuity

The user's requirement implies that health history should remain visible even when a student changes campus or progresses through classes. The backend currently appears to model `Student` as campus-scoped.

Backend should confirm:

- Whether a campus transfer reuses the same `Student.id` or creates a new student record.
- Whether health data should be campus-owned, student-owned globally, or copied/linked during transfer.
- Whether staff at a new campus can see prior-campus medical history.
- Whether prior-campus staff retain access after transfer.
- How archived students and historical enrollments affect health visibility.

This is probably the highest-impact backend decision for frontend data modeling.

### Enrollment Intake Link

The enrollment health form link is not covered by existing parent authenticated request patterns.

Backend should determine:

- Whether the link is authenticated, token-based, invitation-based, or tied to an enrollment workflow.
- Whether the token is single-use, expiring, revocable, campus-scoped, and student-scoped.
- Whether the link can create a new student health record or only update an existing draft.
- What data is safe to prefill on a public/tokenized form.
- How submission ownership and audit actor should be represented.

### Sensitive Health Data Controls

Medical data has higher sensitivity than ordinary profile/request data.

Backend should explicitly decide:

- Which roles can read health profile details.
- Which roles can create/update/review medical requests.
- Whether teachers, nurses, admins, and campus owners see different field subsets.
- Whether parents can see staff notes, review notes, and administration logs.
- Whether attachments require stricter permissions than ordinary files.
- Whether health data needs separate audit events or retention rules.

## Suggested Backend Investigation Path

1. Confirm the intended V1 scope:
   - Baseline health profile only.
   - Parent medical request and staff review only.
   - Enrollment intake only.
   - Administration tracking included or deferred.

2. Decide the data ownership model:
   - Campus-scoped health data.
   - Student-global health data.
   - Campus-scoped records with explicit transfer/copy history.

3. Reuse the Absence Request architecture where applicable:
   - Parent action resolves guardian from authenticated user.
   - Staff action uses campus access and permissions.
   - Domain/use-case/repository boundaries remain vertical-slice oriented.
   - Tests cover relationship enforcement and campus boundaries.

4. Define health permissions before API finalization:
   - Permission module name.
   - Staff roles allowed to read/write/review/administer.
   - Parent-visible vs staff-only fields.

5. Decide attachment policy before frontend builds upload UX:
   - Allowed file types.
   - Max file size.
   - Multiple vs single attachment.
   - Who can download/delete.
   - Whether uploaded files must be linked only after request/profile submit.

6. Decide whether public intake links are part of this backend slice or a separate enrollment/onboarding slice.

## Backend Questions To Answer

- Does the backend consider health information a part of `Student`, a separate health profile, or a request/history domain?
- What is the canonical student identity across campus transfer?
- Should parents be able to submit medical instructions for every linked child, or only currently active/enrolled children?
- Are medical requests approved/denied like absence requests, or do they need additional states such as active, completed, cancelled, expired, administered, or partially administered?
- Can parents edit or cancel a submitted medical request?
- Should staff record each medication administration event, or is approval enough for V1?
- Should health profile edits require staff approval when submitted by parents?
- Which staff roles can see sensitive fields and attachments?
- Are health attachments stored using the existing file service or a stricter storage path/policy?
- How should public enrollment health links be generated, expired, revoked, and audited?
- Does the backend need append-only history for every health profile change?
- What should happen to pending medical requests when a student transfers class, campus, or becomes archived?

## Risks And Dependencies

- Frontend cannot finalize data models until backend decides campus-scoped vs student-global health ownership.
- Public intake links may require a new auth/security pattern and should not be treated like a normal authenticated endpoint without backend review.
- Medical attachments may require stricter validation than existing file uploads currently enforce.
- RBAC changes may affect navigation, button visibility, and empty/error states in the frontend.
- If administration logging is included in V1, the frontend will need a separate staff workflow beyond request review.
- If health history must be append-only, frontend update screens should be designed as submissions/events rather than simple overwrite forms.
- If parents can update health profiles directly, backend must define whether changes are immediately effective or pending approval.

## Candidate API Areas For Backend Spec

This section is intentionally conceptual and not a contract. Backend should decide exact endpoint names and payloads.

- Parent child/campus discovery: likely reuse existing Guardian APIs.
- Student health profile read/update: new or extended student-health API.
- Parent medical request create/list/detail/cancel: likely similar to Absence Request parent endpoints.
- Staff medical request list/detail/review: likely similar to Absence Request staff endpoints with health-specific permissions.
- Health history/timeline: needed if frontend must show previous profile changes, requests, reviews, and administration events.
- Enrollment health intake link: likely separate tokenized intake API if the form is accessed through a link before normal authenticated parent app flow.
- Attachment association: likely use existing file upload service plus a health-specific association and validation policy.

## Validation Notes

Research was based on Knowns docs plus direct backend code discovery. The most relevant existing backend implementation is Absence Request. No dedicated health/medical implementation was found during search.
