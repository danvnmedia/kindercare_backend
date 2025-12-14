# Event Handler Pattern

> Async event processing. Located in `src/application/{module}/event-handlers/`

---

## Dispatcher

Located in `src/core/events/domain-event.dispatcher.ts`

```typescript
@Injectable()
export class DomainEventDispatcher {
  private handlers: Map<string, ((event: DomainEvent) => Promise<void>)[]> = new Map();

  register<T extends DomainEvent>(eventName: string, handler: (event: T) => Promise<void>): void {
    const existing = this.handlers.get(eventName) ?? [];
    this.handlers.set(eventName, [...existing, handler]);
  }

  async dispatch<T extends DomainEvent>(event: T): Promise<void> {
    const handlers = this.handlers.get(event.eventName) ?? [];
    await Promise.all(handlers.map((h) => h(event)));
  }
}
```

---

## Handler Implementation

```typescript
@Injectable()
export class OrderEventHandlers {
  private readonly logger = new Logger(OrderEventHandlers.name);

  constructor(
    private readonly eventDispatcher: DomainEventDispatcher,
    private readonly emailService: EmailService,
  ) {
    this.registerHandlers();
  }

  private registerHandlers(): void {
    this.eventDispatcher.register<OrderCreatedEvent>(
      'order.created',
      this.handleOrderCreated.bind(this),
    );
    this.eventDispatcher.register<OrderPaidEvent>(
      'order.paid',
      this.handleOrderPaid.bind(this),
    );
  }

  private async handleOrderCreated(event: OrderCreatedEvent): Promise<void> {
    this.logger.log(`Order created: ${event.payload.orderId}`);
  }

  private async handleOrderPaid(event: OrderPaidEvent): Promise<void> {
    await this.emailService.sendOrderConfirmation({
      orderId: event.payload.orderId,
      userId: event.payload.userId,
    });
  }
}
```

---

## Publishing from Repository

```typescript
async save(order: Order): Promise<Order> {
  const created = await this.prisma.order.create({ data });

  // Dispatch events after persistence
  for (const event of order.domainEvents) {
    await this.eventDispatcher.dispatch(event);
  }
  order.clearDomainEvents();

  return PrismaOrderMapper.toDomain(created);
}
```
