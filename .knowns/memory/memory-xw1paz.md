---
id: xw1paz
title: Four-Layer Immutability Pattern for Generated Codes
layer: project
category: pattern
tags:
  - domain
  - immutability
  - clean-architecture
  - prisma
  - mapper
createdAt: '2026-04-21T17:19:31.229Z'
updatedAt: '2026-04-21T17:19:31.229Z'
---

When a generated field (like `studentCode` or `staffCode`) must be immutable after creation, enforce it at **four** layers — a single type-level omission isn't enough because other paths can bypass it:

1. **Domain entity** — field required on creation, read-only getter, and excluded from `UpdateXxxData` type via `Omit`.
2. **Factory method** — format validated on `.create(...)` with a regex so garbage input can't be reconstituted.
3. **Prisma mapper** — field included in `toDomain` and `toPrisma` (create), but **excluded** from `toPrismaUpdate` with an explanatory comment.
4. **Unit of Work port** — update-data shape (e.g. `updateStaff`) does **not** accept the field at all, so transaction code can't slip it through.

Skipping any layer leaves a hole: for example, if only the entity type omits it but the mapper still writes it from `staff.code` on update, code can still mutate via repository → mapper. See `prisma-staff.mapper.ts` (`toPrismaUpdate` comment) and `UnitOfWorkPort.updateStaff` for the reference implementation.
