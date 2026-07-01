---
title: File Upload Production Readiness Review
description: Deep review of FE/BE CMS file upload flow, hardening changes, validation, and remaining production follow-ups
createdAt: '2026-06-30T17:31:00.788Z'
updatedAt: '2026-07-01T00:00:00.000Z'
tags:
  - upload
  - r2
  - frontend
  - backend
  - production
  - review
---

# File Upload Production Readiness Review

Date: 2026-07-01
Scope: kindercare_frontend, kindercare_backend

## Result

FE/BE post attachment upload flow is connected and builds successfully. Flow remains: POST /files/initiate-upload -> direct presigned R2 PUT -> POST /files/:id/complete. Backend owns storage path derivation; frontend does not send uploadPath.

## Changes Applied

- Frontend production upload URL allowlist now fails closed unless NEXT_PUBLIC_R2_UPLOAD_HOSTS is configured. Wildcard R2 hosts remain dev-only.
- Frontend post attachments previously used strict POST_ATTACHMENT audience context. Backend current contract is now universal: `campusId` required; `audienceType` optional; `ALL`/omitted or `CLASS + audienceId` only.
- Post upload manager and alternate post attachment service now use initiatePostAttachmentUpload.
- Backend removed image/svg+xml from allowed upload MIME types.
- Backend R2 upload presigned URL default TTL reduced to 900 seconds.
- Validation doc updated at docs/validation/file-upload-flow-validation.md.

## Validation

- kindercare_backend: npm run build passed.
- kindercare_frontend: npm run build passed.

## Remaining Prod Follow-ups

- Add endpoint rate limits/quotas for initiate/complete upload.
- Add E2E/API coverage for guardian post visibility: ALL visible, unrelated CLASS hidden, linked-child CLASS visible.
- Decide signed-read vs R2_PUBLIC_DOMAIN public bearer URL mode per privacy requirements.
- Run manual deployed browser smoke against live R2/CORS/CSP/image host config.


## Cleanup and Test Implementation 2026-07-01

Requested scope narrowed to stale PENDING/orphan R2 cleanup and upload flow tests only. Public R2 read URLs remain intended when R2_PUBLIC_DOMAIN is configured.

Implemented:

- Added CleanupStalePendingUploadsUseCase. It finds PENDING file rows older than a cutoff, checks storage metadata, deletes existing objects, marks file rows ERROR, and records delete failures without blocking DB cleanup.
- Added FileRepository.findStalePending(cutoff, limit) and Prisma implementation ordered by oldest updatedAt.
- Wired CleanupTask hourly cleanup to run stale pending upload cleanup with 1 hour cutoff and limit 100.
- Wired daily cleanup to run stale pending upload cleanup with 24 hour cutoff and limit 500.
- Added upload flow tests for valid upload creation, R2 provider metadata, audience path derivation, SVG rejection, and signing failure ERROR transition.
- Added cleanup tests for orphan object deletion, no-object cleanup, and delete failure handling.

Validation:

- npm test -- upload-file.use-case.spec.ts cleanup-stale-pending-uploads.use-case.spec.ts passed.
- npm run build passed.

Still intentionally not included in this scope:

- Endpoint throttling/quotas.


## Cross-Agent Workflow Validation 2026-07-01

Validated with separate backend and frontend review agents.

Backend findings:

- Upload flow remains auth/campus guarded: initiate -> presigned R2 PUT -> complete.
- Initiate creates PENDING rows, derives server-owned keys, signs short-lived PUT URLs, and marks ERROR on sign failure.
- Complete enforces campus/uploader/status checks, verifies object metadata, then marks UPLOADED.
- CMS attachment linking checks post campus and file availability; PENDING/ERROR files cannot attach.
- Stale PENDING cleanup is wired hourly and daily; existing orphan objects are deleted when possible and rows are marked ERROR.

Frontend findings:

- CMS post form validates image type/size/count/dedupes, compresses selected image, initiates upload with transformed metadata, PUTs transformed file to R2, completes upload, then attaches by fileId after post create/update.
- Submit is blocked while uploads are queued/active.
- Edit mode avoids duplicate attachment creation for existing images.
- Client upload URL allowlist and HTTPS checks provide defense in depth; NEXT_PUBLIC_R2_UPLOAD_HOSTS must be configured in production.

Validation run:

- kindercare_backend: npm run build passed via backend review agent.
- kindercare_backend: npm test -- --runTestsByPath src/application/file-management/use-cases/upload-file.use-case.spec.ts src/application/file-management/use-cases/cleanup-stale-pending-uploads.use-case.spec.ts --runInBand produced no failures via backend review agent.
- kindercare_frontend: npm run build passed.
- kindercare_frontend: npm run lint completed with existing warnings only; no upload/CMS-specific errors surfaced.

Current production gaps:

- Add rate limits/quotas for initiate/complete endpoints.
- Add E2E/API coverage for guardian post visibility: ALL visible, unrelated CLASS hidden, linked-child CLASS visible.
- Manual E2E smoke still needed against deployed R2/CORS/CSP/image host config.
- If addAttachment fails after completeUpload, uploaded file may remain unattached until cleanup or manual remediation.
- Public R2_PUBLIC_DOMAIN mode is intentional for public media but should not be used for private files.


## Complete Upload Test Validation 2026-07-01

Added direct CompleteUploadUseCase unit coverage for finalization invariants:

- PENDING file with matching storage metadata marks UPLOADED and returns URL.
- Missing campus-scoped file rejects before storage lookup.
- Wrong uploader rejects before storage lookup.
- Non-PENDING file rejects before storage lookup.
- Missing storage object rejects without updating the file.
- Storage object size mismatch rejects without updating the file.
- Storage object content type mismatch rejects without updating the file.
- Storage metadata failure does not mark the file UPLOADED or persist an update.

Validation:

- npm test -- --runTestsByPath src/application/file-management/use-cases/complete-upload.use-case.spec.ts --runInBand --silent passed: 8 tests.
- kindercare_backend npm run build passed.
- kindercare_frontend npm run build passed.

Static deploy smoke config validation:

- Frontend upload host allowlist uses NEXT_PUBLIC_R2_UPLOAD_HOSTS and fails closed in production when empty.
- Frontend upload PUT enforces HTTPS and host allowlist before fetch.
- next.config.ts includes R2 image remotePatterns via NEXT_PUBLIC_R2_IMAGE_HOSTS plus R2 defaults.
- proxy.ts CSP connect-src includes R2 upload hosts from NEXT_PUBLIC_R2_UPLOAD_HOSTS and R2 defaults.

Manual deployed browser smoke is still required because local static validation cannot verify live R2 bucket CORS, real presigned URL host, deployed env values, or returned public URL rendering from production.


## Loose Docs Consolidation 2026-07-01

Merged durable upload-specific points into `@doc/architecture/file-management-and-storage` and durable CMS audit/refactor points into `@doc/architecture/content-management-system`.

The loose validation doc had one stale complete-upload sequence section that listed marking `UPLOADED` before metadata verification. Canonical current behavior is metadata verification first, then `UPLOADED` persistence.

The loose docs were removed after consolidation to avoid drift against Knowns-managed docs.

## Universal Upload and Post Audience Filtering 2026-07-01

Backend upload contract was simplified for reuse across all image/file surfaces:

- `campusId` is the only required business scope for `POST /files/initiate-upload`.
- `audienceType` is optional. Omitted or `ALL` means campus-wide storage grouping.
- `CLASS + audienceId` is supported and validates that the class belongs to the same campus.
- The public file upload audience contract exposes only `ALL` and `CLASS`. Student/class/medical/meal/school/avatar semantics should be represented by `purpose` and owning feature records, not by upload audience scope.
- Backend still owns key/path derivation. Frontend must not send `uploadPath`, bucket, or object key.

CMS post visibility now handles the feed audience rules directly:

- CMS post `AudienceType` exposes only `ALL` and `CLASS`.
- Whole-school posts (`AudienceType.ALL`) are visible to the whole campus.
- Class-targeted posts (`AudienceType.CLASS`) are visible to staff/admin and to guardians whose linked child has an active enrollment in the selected class.
- `GET /posts` and `GET /posts/:id` both pass the current user into repository visibility filtering.
- Migration `20260701001000_remove_grade_student_post_audience` deletes legacy `GRADE`/`STUDENT` post-audience rows, drops their foreign keys/indexes, and removes `student_id`/`grade_level_id` from `post_audience`.

Validation:

- `npx jest src/application/file-management/use-cases/upload-file.use-case.spec.ts --runInBand --json --outputFile=jest-upload.json --silent` passed: 9 tests.
- Changed-file diagnostics for upload use case, upload DTOs, post controller, post use cases, and Prisma post repository were clean.

Remaining production follow-ups:

- Add endpoint rate limits/quotas for initiate/complete upload.
- Add E2E/API coverage for guardian post visibility: ALL visible, unrelated CLASS hidden, linked-child CLASS visible.
- Manual deployed browser smoke is still required for live R2 bucket CORS, deployed env, CSP, upload host allowlist, and rendered public/signed read URLs.
