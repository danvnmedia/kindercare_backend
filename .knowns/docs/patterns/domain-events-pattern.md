---
title: Domain Events Pattern (Not Implemented)
description: Aspirational pattern. The codebase does not currently emit domain events; cross-system reactions are wired with the saga + Unit of Work pattern instead.
createdAt: '2026-01-03T19:52:33.562Z'
updatedAt: '2026-05-05T17:33:12.274Z'
tags:
  - patterns
  - events
  - domain
  - not-implemented
  - aspirational
---

# Domain Events Pattern (Not Implemented)

> **Status**: This pattern is **not currently implemented** in the codebase. There are no `DomainEvent` base classes, no `EntityWithEvents`, and no event dispatcher. Entities track their own state changes synchronously inside `Entity<Props>` methods (see [@doc/patterns/entity-pattern](patterns/entity-pattern)).

## What the Codebase Does Instead

When an action needs to trigger work in another part of the system, the codebase uses one of these approaches:

| Need | Mechanism | Example |
|------|-----------|---------|
| Atomic multi-table writes | Unit of Work + `TransactionContext` | `CreateStaffUseCase` creating `User` + `Staff` + `UserRole` |
| Cross-system orchestration with rollback | Saga (Clerk + DB) | `UpdateGuardianUseCase` reverting Clerk on DB failure |
| Append-only audit log | Direct write inside the same transaction | `PostHistoryStatus` row written when post status changes |
| Async background work | BullMQ queue | `QueueService.addEmailJob` → `EmailProcessor` |
| Recurring scheduled work | NestJS `@Cron(...)` | `CleanupTask` |

References:

- [@doc/patterns/unit-of-work-pattern](patterns/unit-of-work-pattern)
- [@doc/patterns/saga-pattern](patterns/saga-pattern)
- [@doc/architecture/queue-and-cronjob](architecture/queue-and-cronjob)

## When You Might Want True Domain Events

Adopt domain events if multiple **independent** modules need to react to the same fact and you want them decoupled. Today the reactions are few and direct, so the cost of an event bus outweighs the benefit. Don't add `DomainEvent` until at least three callers want to react to the same fact and the in-line approach is causing real coupling.

## If You Add Them Later

A reasonable starter shape (do not introduce until needed):

```typescript
// src/core/events/domain-event.ts
export abstract class DomainEvent<T = unknown> {
  readonly occurredOn: Date = new Date();
  abstract readonly eventName: string;
  abstract readonly payload: T;
}

// src/core/entities/entity-with-events.ts
export abstract class EntityWithEvents<Props> extends Entity<Props> {
  private _events: DomainEvent[] = [];

  protected addDomainEvent(event: DomainEvent): void { this._events.push(event); }
  public domainEvents(): readonly DomainEvent[] { return this._events; }
  public clearDomainEvents(): void { this._events = []; }
}
```

Repositories would then dispatch events after a successful `save`/`update`. Until that need is real, keep this doc as a marker so contributors don't reintroduce the bullet points across the codebase.
