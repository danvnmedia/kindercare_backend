---
title: Saga Pattern
description: Compensating transactions for orchestrating Clerk + database writes that span systems Prisma cannot roll back
createdAt: '2026-05-05T17:42:40.080Z'
updatedAt: '2026-05-31T02:16:09.897Z'
tags:
  - patterns
  - saga
  - transaction
  - clerk
  - compensation
  - external-services
---

# Saga Pattern

> Coordinating writes that cross transactional boundaries (Clerk + database) by pairing a forward action with an explicit compensating action.

Prisma's `$transaction` only rolls back the database. When a use case must also create or update a Clerk identity, the database transaction can't undo the Clerk side. The saga pattern handles this by:

1. Performing the **forward** external action.
2. Performing the **DB transaction** (wrapped in `UnitOfWorkPort.run`).
3. On DB failure, performing the **compensating** external action to roll back the forward step.

Compensation is **best-effort**. Failures are logged so an operator can clean up — they do not raise to the caller.

## Canonical Shape

```typescript
async execute(input: CreateStaffInput): Promise<Staff> {
  // 1. Pre-flight (read-only)
  await this.checkStaffUniqueness(input);

  // 2. Forward action against the external system
  const clerkUser = await this.identityPort.provisionUser({
    email: input.email,
    fullName: input.fullName,
    phoneNumber: input.phoneNumber,
    password: DEFAULT_WEAK_PASSWORD,
  });

  try {
    // 3. DB transaction — atomic across many tables
    const staff = await this.unitOfWork.run(async (tx) => {
      const user = await tx.createUser({ clerkUid: clerkUser.clerkUid, isActive: true });
      const staffEntity = Staff.create({ ...input, staffCode, userId: user.id });
      await tx.createStaff({ id: staffEntity.id, /* … */ });
      if (defaultRoleId) {
        await tx.assignRoles(user.id, [{ roleId: defaultRoleId, campusId: input.campusId }]);
      }
      return staffEntity;
    });

    return staff;
  } catch (error) {
    // 4. Compensation — roll back the forward step
    this.logger.error(`DB transaction failed, compensating by deleting Clerk user: ${clerkUser.clerkUid}`);
    await this.compensateClerkUser(clerkUser.clerkUid);
    throw new BadRequestException(`Failed to create staff: ${error.message}`);
  }
}

private async compensateClerkUser(clerkUid: string): Promise<void> {
  try {
    await this.identityPort.deleteIdentity(clerkUid);
  } catch (compensationError) {
    // Best effort — log and continue. Production should drop a dead-letter event.
    this.logger.error(
      `Compensation FAILED: Could not delete Clerk user ${clerkUid}. Manual cleanup required.`,
      compensationError.stack,
    );
  }
}
```

## Where the Pattern Is Used

| Use case | Forward | Compensation |
|----------|---------|--------------|
| `CreateStaffUseCase` | `provisionUser` (create Clerk user) | `deleteIdentity` |
| `CreateGuardianUseCase` | `provisionUser` | `deleteIdentity` |
| `UpdateGuardianUseCase` | `updateUser` (email/phone/name on Clerk) | `updateUser` with original values |
| `UpdateStaffUseCase` | `updateUser` | `updateUser` with original values |
| `ArchiveGuardianUseCase` | `lockIdentity` (lock Clerk user) | (best-effort up-front; if DB fails, lock stays — see below) |
| `DeleteGuardianUseCase` | `deleteIdentity` | (no compensation; it's destructive) |

## Variants

### Variant A — Forward-then-DB (most common)

The forward action is the **most likely to fail** (external HTTP). Do it first, then commit the DB. If the DB fails, compensate.

> **Why first?** If the DB write succeeded but Clerk failed, we'd have a "user" with no identity — much worse than a Clerk identity with no DB row, which compensation can clean up.

### Variant B — Update-with-revert

For identity-linked updates, detect Clerk-relevant changes first, then save the original values before calling the external service so compensation can restore them.

Canonical flow:

1. Detect changes into a `ClerkChanges` object, usually email, phone number, and full name.
2. If the entity has no linked `userId` or no Clerk-relevant changes, skip the saga branch entirely and run the normal DB update.
3. Snapshot original Clerk values before the external call.
4. Update Clerk first through `identityPort.updateUser(...)`.
5. Run the DB transaction through `UnitOfWorkPort.run(...)`.
6. If the DB transaction fails, call a best-effort revert helper that restores only the fields that were actually applied.
7. Re-throw the original DB-facing failure after compensation.

```typescript
const clerkChanges = this.detectClerkChanges(guardian, input);
const originalValues: ClerkOriginalValues = {
  email: guardian.email,
  phoneNumber: guardian.phoneNumber,
  fullName: guardian.fullName,
};

await this.identityPort.updateUser(user.clerkUid, clerkChanges);
try {
  return await this.unitOfWork.run(async (tx) => {
    // ... DB update and audit/event writes
  });
} catch (dbError) {
  await this.revertClerkChanges(user.clerkUid, originalValues, clerkChanges);
  throw new BadRequestException(`Failed to update guardian: ${dbError.message}`);
}
```

`IdentityService.updateUser` already owns primary-email and primary-phone replacement, so new identity-linked entities following this pattern should not need infrastructure-layer Clerk changes.

See `UpdateGuardianUseCase.revertClerkChanges` and `UpdateStaffUseCase` for the canonical implementations.
### Variant C — Lock-then-DB-then-(no compensation)

For archive (soft delete), the forward action is `lockIdentity`. If the DB fails, we **don't unlock** — the lock is reversible by an operator and is far less harmful than an inconsistent archived state. The `archive` use cases call `lockIdentity` *before* the DB transaction without try/catch around it; the lock is "best-effort up-front".

```typescript
if (guardian.hasUserAccount()) {
  await this.lockClerkUser(guardian.userId!);   // best-effort, swallows errors
}
await this.unitOfWork.run(async (tx) => { … });  // DB write
```

## When NOT to Use a Saga

- **Pure DB operations** — use the Unit of Work alone.
- **Optional side effects** (e.g. sending an email) — push to a BullMQ queue inside the transaction; if the DB rolls back, the job won't be enqueued.
- **Read-after-write** — sagas don't help here.

## Compensation Rules

1. **Compensation must not throw.** Wrap it in its own try/catch and log. The original error must surface to the user.
2. **Compensation is idempotent.** `deleteIdentity` on an already-deleted user is fine; `lockIdentity` on a locked user is fine.
3. **Don't compensate destructive forward actions.** If you `deleteIdentity` and the DB write fails, you can't undo the deletion — design so the DB write happens first instead.
4. **Log every compensation outcome.** Operators read the logs to identify orphaned external state.
5. **Don't put a saga inside a UoW.** External calls cannot run inside a Prisma transaction (the connection holds a transaction lock).

## Pitfalls

| Mistake | Symptom |
|---------|---------|
| Calling Clerk inside `unitOfWork.run` | Transaction times out; if the rollback happens after Clerk succeeded, you have orphan state |
| Not catching compensation errors | Compensation failure shadows the original DB error |
| Forgetting to capture original values for `updateUser` | Can't restore the previous state |
| Compensating after the user already saw 200 OK | Don't — at 200 the saga is "complete"; compensation is for failed forwards |
| Putting business assertions in the compensation | Keep it dumb: undo the forward and log |

## Future Direction

When more sagas appear or compensation needs to retry, introduce a saga library or a dead-letter compensation queue. Today, manual cleanup from logs is the recovery path.

Queueing primitives for a future saga state machine are documented in @doc/architecture/queue-and-cronjob.
## Reference

| File | Notes |
|------|-------|
| `src/application/user-management/use-cases/staff/create-staff.use-case.ts` | Variant A |
| `src/application/user-management/use-cases/guardian/update-guardian.use-case.ts` | Variant B with field-level revert |
| `src/application/user-management/use-cases/guardian/archive-guardian.use-case.ts` | Variant C (lock-best-effort) |
| `src/application/user-management/use-cases/guardian/delete-guardian.use-case.ts` | Hard-delete with no compensation |
| `src/application/ports/identity.port.ts` | The forward/compensation surface (`provisionUser`, `updateUser`, `deleteIdentity`, `lockIdentity`, `unlockIdentity`) |
