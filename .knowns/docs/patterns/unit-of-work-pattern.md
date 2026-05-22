---
title: Unit of Work Pattern
description: Transaction management via UnitOfWorkPort + TransactionContext, with modular per-domain TransactionOps classes
createdAt: '2026-01-03T19:52:40.012Z'
updatedAt: '2026-05-20T00:54:31.570Z'
tags:
  - patterns
  - transaction
  - persistence
  - unit-of-work
---

# Unit of Work Pattern

> Transaction management. Port at `src/application/ports/unit-of-work.port.ts`; Prisma implementation at `src/infra/persistence/prisma/unit-of-work/`.

The UoW gives use cases a single seam to wrap multi-table writes in a Prisma interactive transaction. Use it when a single business operation must succeed or fail as a whole — e.g. creating a `User` + `Staff` + `UserRole` together.

## The Port

```typescript
// src/application/ports/unit-of-work.port.ts
export abstract class UnitOfWorkPort {
  abstract run<T>(task: (tx: TransactionContext) => Promise<T>): Promise<T>;
}
```

The closure receives a `TransactionContext` — a composed object with raw, transactional operations for the domains that need them. **The context is intentionally narrow**: it only exposes the data shapes use cases pass in, not full repository surfaces. This keeps the transaction boundary obvious and prevents queries from leaking out through unintended APIs.

```typescript
export interface TransactionContext {
  // User
  createUser(data: { clerkUid: string; isActive: boolean }): Promise<{ id: string; clerkUid: string }>;
  updateUser(id: string, data: { isActive?: boolean }): Promise<{ id: string }>;
  assignRoles(userId: string, assignments: RoleAssignmentInput[]): Promise<void>;

  // Guardian
  createGuardian(data: { /* … */ }): Promise<{ id: string }>;
  updateGuardian(id: string, data: { /* … */ }): Promise<{ id: string }>;

  // Staff
  createStaff(data: { /* … */ }): Promise<{ id: string }>;
  updateStaff(id: string, data: { /* … */ }): Promise<{ id: string }>;

  // Student
  updateStudent(id: string, data: { /* … */ }): Promise<{ id: string }>;
}
```
## Implementation: Modular Transaction Ops

The Prisma implementation composes the `TransactionContext` from per-domain operation classes, each of which receives the active Prisma transaction client.

```
src/infra/persistence/prisma/unit-of-work/
├── prisma-unit-of-work.ts            # exposes UoW; composes the context
├── transaction-operations/
│   ├── base.transaction-ops.ts       # PrismaTransactionClient type alias
│   ├── user.transaction-ops.ts       # createUser, updateUser, assignRoles
│   ├── guardian.transaction-ops.ts   # createGuardian, updateGuardian
│   ├── staff.transaction-ops.ts      # createStaff, updateStaff
│   ├── student.transaction-ops.ts    # updateStudent
│   └── index.ts
```

```typescript
// prisma-unit-of-work.ts
@Injectable()
export class PrismaUnitOfWork extends UnitOfWorkPort {
  constructor(private readonly prisma: PrismaService) { super(); }

  async run<T>(task: (tx: TransactionContext) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (prismaTx) => {
      return task(this.createTransactionContext(prismaTx));
    });
  }

  private createTransactionContext(tx: PrismaTransactionClient): TransactionContext {
    const userOps = new UserTransactionOps(tx);
    const guardianOps = new GuardianTransactionOps(tx);
    const staffOps = new StaffTransactionOps(tx);
    const studentOps = new StudentTransactionOps(tx);

    return {
      createUser: userOps.createUser.bind(userOps),
      assignRoles: userOps.assignRoles.bind(userOps),
      // …
      updateStudent: studentOps.updateStudent.bind(studentOps),
    };
  }
}
```

Each `*TransactionOps` class is a thin wrapper over a single Prisma model, scoped to the transaction client:

```typescript
export class UserTransactionOps {
  constructor(private readonly tx: PrismaTransactionClient) {}

  async createUser(data: { clerkUid: string; isActive: boolean }) {
    const user = await this.tx.user.create({ data });
    return { id: user.id, clerkUid: user.clerkUid };
  }

  async assignRoles(userId: string, assignments: RoleAssignmentInput[]): Promise<void> {
    await this.tx.userRole.createMany({
      data: assignments.map(a => ({ userId, roleId: a.roleId, campusId: a.campusId ?? null })),
      skipDuplicates: true,
    });
  }
}
```
## Use in a Use Case

```typescript
async execute(input: CreateStaffInput): Promise<Staff> {
  // 1. Stuff that must happen first (external-service call, code generation)
  const clerkUser = await this.identityPort.provisionUser({ ... });
  const staffCode = await this.staffCodeGenerator.generateNextCode(input.campusId);

  try {
    // 2. Atomic DB writes inside a single transaction
    const staff = await this.unitOfWork.run(async (tx) => {
      const user = await tx.createUser({ clerkUid: clerkUser.clerkUid, isActive: true });
      const staffEntity = Staff.create({ ...input, staffCode, userId: user.id });
      await tx.createStaff({ id: staffEntity.id, /* … all fields */ });
      if (defaultRoleId) {
        await tx.assignRoles(user.id, [{ roleId: defaultRoleId, campusId: input.campusId }]);
      }
      return staffEntity;
    });
    return staff;
  } catch (error) {
    // 3. Compensation for the external service (saga pattern)
    await this.compensateClerkUser(clerkUser.clerkUid);
    throw error;
  }
}
```

The Clerk call sits **outside** the transaction because Prisma can't roll it back. The pairing of "external call + UoW + compensation" is the **saga pattern** — see [@doc/patterns/saga-pattern](patterns/saga-pattern).

## When to Use UoW

| Scenario | UoW? |
|----------|------|
| Any mutation that emits audit / domain events | **Yes** — `tx` must wrap the mutation + the audit/event write |
| Multi-row writes that must be atomic (User + Staff + UserRole) | Yes |
| Read-only operations | No — use the repository directly |
| External call + DB write | Saga pattern: external call outside, UoW inside, compensation on failure |
| Bulk operations with their own internal `$transaction` (e.g. `repo.saveMany`) | No — the repo owns its own atomicity boundary |

### Rationale

With `@doc/specs/admin-audit-log` D4 (same-tx audit emission), single-row mutations no longer exist in practice — every business mutation is at least a 2-row write (mutation + `audit_event`). Making both atomic requires the mutation to participate in the caller's transaction, which means going through `unitOfWork.run((tx) => …)`. The previous "single-row → repo directly" rule pre-dated the audit layer and is no longer the recommended default.

This aligns with the industry-standard pattern: Spring's `@Transactional` everywhere, EF Core's `DbContext`-as-UoW, Rails' `transaction` blocks. New mutations and refactored use cases follow the new rule by default.

### Migration note

Existing repo-direct callers — e.g. `archive-student`, `restore-student`, `update-student-guardian-relationship`, and single-row updates in `class-management/`, `campus/`, `grade-level/`, `school-year/` — **still use `repo.update()` directly** and continue to be valid. They migrate to UoW as their own audit-wiring tasks land (e.g. `@task-2c5xq3`, `@task-7ah3pb`). The decision table above is the **forward-looking convention**, not a hard cutover; do not bulk-rewrite legacy callers without an accompanying audit-wiring scope.
## Adding a New Domain

To extend the `TransactionContext` with another domain:

1. Add the operations to the `TransactionContext` interface.
2. Create `src/infra/persistence/prisma/unit-of-work/transaction-operations/{domain}.transaction-ops.ts` with a class that takes `PrismaTransactionClient` and exposes the methods.
3. Wire the new ops class into `createTransactionContext` in `prisma-unit-of-work.ts`.
4. Export it from `transaction-operations/index.ts`.

The whole point of the modular approach is that step 3 is short — adding a domain is a one-line addition, not a refactor of the UoW class.

## Pitfalls

| Mistake | Symptom |
|---------|---------|
| Making external API calls (Clerk, BullMQ) inside `tx.run` | Prisma rollback can't undo them — use the saga pattern instead |
| Forgetting `await` on a `tx.*` call | Silent skip and a possible "Transaction already closed" error |
| Reading via the non-transactional repository inside `tx.run` | Reads outside the transaction's snapshot — can cause subtle inconsistencies |
| Not nesting compensations in the outer try/catch | Compensation runs too late or not at all |
| Returning before all `tx.*` calls have awaited | The transaction may close before pending writes commit |

## Reference

| File | Notes |
|------|-------|
| `src/application/ports/unit-of-work.port.ts` | The port and `TransactionContext` shape |
| `src/infra/persistence/prisma/unit-of-work/prisma-unit-of-work.ts` | Composition |
| `src/infra/persistence/prisma/unit-of-work/transaction-operations/*.ts` | Per-domain ops |
| `src/application/user-management/use-cases/staff/create-staff.use-case.ts` | Saga + UoW example |
| `src/application/user-management/use-cases/guardian/archive-guardian.use-case.ts` | UoW + Clerk lock |
