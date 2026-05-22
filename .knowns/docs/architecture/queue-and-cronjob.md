---
title: Queue and Cronjob
description: 'Async background work via BullMQ + Redis, and scheduled tasks via NestJS @Cron'
createdAt: '2026-05-05T17:49:46.719Z'
updatedAt: '2026-05-05T17:49:46.719Z'
tags:
  - architecture
  - queue
  - bullmq
  - cron
  - scheduled
  - async
---

# Queue and Cronjob

> Background work uses **BullMQ** (Redis-backed) for jobs and **NestJS `@Cron`** for scheduled tasks. Both are application-level scaffolding; new work goes here when it shouldn't block the request.

## Queue (BullMQ)

### Module wiring

`src/infra/queue/queue.module.ts`:

```typescript
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        redis: {
          host: configService.get("REDIS_HOST", "localhost"),
          port: configService.get("REDIS_PORT", 6379),
          password: configService.get("REDIS_PASSWORD"),
        },
      }),
    }),
    BullModule.registerQueue({ name: "email" }),
  ],
  providers: [EmailProcessor, QueueService],
  exports: [QueueService, BullModule],
})
export class QueueModule {}
```

`QueueModule` is imported by `AppModule`, so BullMQ is available app-wide.

### Defining a queue

Each queue has a string name and a processor. Currently:

| Queue | Processor | Purpose |
|-------|-----------|---------|
| `email` | `EmailProcessor` | Outbound email (placeholder implementation) |

To add a new queue:

1. **Register** in `QueueModule.imports`: `BullModule.registerQueue({ name: "notify-guardian" })`.
2. **Create the processor** at `src/infra/queue/processors/notify-guardian.processor.ts`:
   ```typescript
   @Processor("notify-guardian")
   export class NotifyGuardianProcessor {
     private readonly logger = new Logger(NotifyGuardianProcessor.name);

     @Process("send")
     async handleSend(job: Job<NotifyGuardianJobData>) {
       this.logger.log(`Sending notification to ${job.data.guardianId}`);
       // … work
       return { success: true, sentAt: new Date() };
     }
   }
   ```
3. **Add the processor** to `QueueModule.providers`.
4. **Expose** an enqueue method on `QueueService` (or inject the queue directly via `@InjectQueue("notify-guardian")`).

### Enqueueing a job

```typescript
// src/infra/queue/queue.service.ts
@Injectable()
export class QueueService {
  constructor(@InjectQueue("email") private emailQueue: Queue) {}

  async addEmailJob(data: EmailJobData, delay?: number) {
    const job = await this.emailQueue.add("send-email", data, {
      delay,
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
    });
    return job.id;
  }
}
```

Standard options:

- `attempts: 3` — total tries including the first.
- `backoff: { type: "exponential", delay: 2000 }` — 2s, 4s, 8s.
- `delay` — schedule for the future (in ms).

### Calling from a use case

Inject `QueueService` (or the queue directly) and enqueue inside the same handler that did the DB write:

```typescript
async execute(input: PublishPostInput): Promise<Post> {
  const post = await this.publishPostUseCase.execute(input);
  await this.queueService.addEmailJob({
    to: parent.email,
    subject: `New post: ${post.title}`,
    text: post.contentText,
  });
  return post;
}
```

If the DB transaction was wrapped in `unitOfWork.run`, enqueue **inside** the closure so an aborted transaction doesn't leave dangling jobs. (BullMQ jobs are not transactional with Postgres, but at least the enqueue won't run if the transaction throws first.)

### Status & monitoring

`QueueService.getEmailQueueStatus()` returns the four counts (waiting, active, completed, failed). The intended consumer is an admin dashboard or a health-check endpoint.

For development, BullMQ ships a UI (`@bull-board/express`) — not currently mounted. If you need real visibility, mount it under an admin route gated by a system role.

## Cronjob (NestJS Schedule)

### Module wiring

`src/infra/cronjob/cronjob.module.ts`:

```typescript
@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [CleanupTask],
})
export class CronjobModule {}
```

`ScheduleModule.forRoot()` enables the `@Cron`, `@Interval`, and `@Timeout` decorators.

### Defining a task

```typescript
@Injectable()
export class CleanupTask {
  private readonly logger = new Logger(CleanupTask.name);

  @Cron(CronExpression.EVERY_HOUR)
  async handleCleanup() {
    this.logger.log("Starting cleanup task...");
    // … work
  }

  @Cron("0 0 * * *")              // daily at midnight UTC
  async handleDailyCleanup() {
    this.logger.log("Starting daily cleanup task...");
    // … work
  }
}
```

NestJS supports:

- `@Cron(expression, options?)` — standard cron expression.
- `@Cron(CronExpression.EVERY_*)` — preset enum (every second/minute/hour/day/week).
- `@Interval(milliseconds)` — fixed-rate.
- `@Timeout(milliseconds)` — fire once after delay.

### Adding a task

1. Create `src/infra/cronjob/tasks/{name}.task.ts`.
2. Register in `CronjobModule.providers`.
3. Inject any required services (the task is a NestJS provider — full DI available).

```typescript
@Injectable()
export class PurgeOrphanFilesTask {
  constructor(
    @Inject("FILE_REPOSITORY") private readonly fileRepository: FileRepository,
    private readonly storageService: StorageService,
  ) {}

  @Cron("0 3 * * *", { timeZone: "Asia/Ho_Chi_Minh" })
  async purgeOrphans(): Promise<void> {
    const orphans = await this.fileRepository.findSoftDeletedOlderThan(30);
    for (const file of orphans) {
      await this.storageService.delete(file.key);
      await this.fileRepository.delete(file.id);
    }
  }
}
```

### Time zone

By default, `@Cron` uses the server's local time. Always pass `timeZone` explicitly when the schedule is business-time sensitive (e.g. "send report at 6 AM Vietnam time").

## When to Use What

| Need | Use |
|------|-----|
| Send an email after creating a record | Queue (BullMQ) |
| Retry on failure | Queue with `attempts` |
| Schedule for a specific future time (one-off) | Queue with `delay` |
| Recurring task (daily, hourly) | Cron |
| Long-running batch job | Queue (split into smaller jobs) |
| Synchronous side effect within a request | Direct method call (no queue) |
| Reaction across modules with no time pressure | Queue — keeps modules decoupled |

## Failure Handling

### Queue jobs

- BullMQ retries based on `attempts` + `backoff`.
- Failed jobs land in the "failed" set — operator-visible via `getEmailQueueStatus()`.
- If you want a permanent dead-letter, write a job-event handler:
  ```typescript
  @OnQueueFailed()
  onFailed(job: Job, error: Error) {
    this.logger.error(`Job ${job.id} failed permanently`, error.stack);
    // … persist to a dead_letter table
  }
  ```

### Cron tasks

- A failing cron task logs and continues — it doesn't crash the app.
- The next scheduled tick runs as normal.
- For tasks that need an external alert on failure, push to Sentry/Datadog from the catch block.

## Testability

- **Cron tasks**: instantiate the class directly in unit tests; call the handler method without going through the scheduler.
- **Queue processors**: same — `EmailProcessor.handleSendEmail({ data: {...} } as Job<EmailJobData>)`. Mock the queue dependency in use case tests rather than the real BullMQ.

## Pitfalls

| Mistake | Symptom |
|---------|---------|
| Enqueueing inside a transaction that may roll back | Job runs even though the data didn't persist (or vice versa) — see [@doc/patterns/saga-pattern](patterns/saga-pattern) for cross-system thinking |
| Forgetting `attempts` | Transient Redis blips fail jobs permanently |
| Cron tasks doing heavy DB work without a UoW | Writes are not atomic |
| Running cron on multiple replicas | Same task fires N times — use a leader lock or a single dedicated worker process |
| Time zone drift | Always pass `timeZone` when wall-clock matters |
| Scheduling via `setTimeout` instead of BullMQ `delay` | Lost on process restart |

## Reference

| File | Notes |
|------|-------|
| `src/infra/queue/queue.module.ts` | BullMQ wiring |
| `src/infra/queue/queue.service.ts` | Convenience enqueue methods |
| `src/infra/queue/processors/email.processor.ts` | Processor template |
| `src/infra/cronjob/cronjob.module.ts` | `ScheduleModule.forRoot()` |
| `src/infra/cronjob/tasks/cleanup.task.ts` | Cron task template |
