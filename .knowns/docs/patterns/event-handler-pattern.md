---
title: Event Handler Pattern (Not Implemented)
description: 'Aspirational pattern. There is no in-process event handler infrastructure; async work goes through BullMQ queues, scheduled work through NestJS @Cron.'
createdAt: '2026-01-03T19:52:35.174Z'
updatedAt: '2026-05-05T17:33:34.634Z'
tags:
  - patterns
  - events
  - handler
  - not-implemented
  - aspirational
---

# Event Handler Pattern (Not Implemented)

> **Status**: There is **no in-process domain event dispatcher** in the codebase. The closest thing to "event handlers" is the BullMQ queue and the NestJS scheduled-task system. See [@doc/patterns/domain-events-pattern](patterns/domain-events-pattern) for the rationale.

## What the Codebase Uses for Async Reactions

| Pattern | Use it when | File reference |
|---------|-------------|----------------|
| **BullMQ processor** | A job needs to be retried, scheduled, or run out-of-band (email, notifications, batch work) | `src/infra/queue/processors/email.processor.ts` |
| **NestJS `@Cron`** | A task should run on a schedule | `src/infra/cronjob/tasks/cleanup.task.ts` |
| **Direct call inside the use case** | The reaction is part of the same transaction (status history, audit row) | `SubmitForReviewUseCase` writes `PostHistoryStatus` inline |

## Adding a Queue Handler

```typescript
// 1. Define the job payload
export interface NotifyGuardianJobData {
  guardianId: string;
  reason: string;
}

// 2. Add a processor (registered via BullModule.registerQueue in QueueModule)
@Processor("notify-guardian")
export class NotifyGuardianProcessor {
  private readonly logger = new Logger(NotifyGuardianProcessor.name);

  @Process()
  async handle(job: Job<NotifyGuardianJobData>): Promise<void> {
    this.logger.log(`Notifying guardian ${job.data.guardianId}`);
    // … call services to send email/push/sms
  }
}

// 3. Schedule the work from a use case
await this.queueService.addJob("notify-guardian", { guardianId, reason });
```

See [@doc/architecture/queue-and-cronjob](architecture/queue-and-cronjob) for the full queue module wiring.

## Adding a Scheduled Task

```typescript
@Injectable()
export class ReportingTask {
  @Cron("0 6 * * *", { timeZone: "Asia/Ho_Chi_Minh" })
  async sendDailyReports(): Promise<void> { /* … */ }
}
```

Register it under `CronjobModule.providers`. The `ScheduleModule.forRoot()` import in `CronjobModule` enables `@Cron`/`@Interval`/`@Timeout`.

## If You Adopt Domain Events Later

The shape of an event handler would mirror NestJS's existing patterns:

```typescript
@Injectable()
export class PostStatusChangedHandler {
  constructor(private readonly queueService: QueueService) {}

  async handle(event: PostStatusChanged): Promise<void> {
    if (event.payload.newStatus === "PUBLISHED") {
      await this.queueService.addJob("notify-audience", { postId: event.payload.postId });
    }
  }
}
```

Don't introduce until [@doc/patterns/domain-events-pattern](patterns/domain-events-pattern) gives you a reason to.
