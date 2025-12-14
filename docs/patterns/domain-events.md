# Domain Events Pattern

> Event-driven workflows. Located in `src/domain/{module}/events/`

---

## Base Event

```typescript
export abstract class DomainEvent<T = unknown> {
  public readonly occurredOn: Date;
  public readonly payload: T;

  protected constructor(payload: T) {
    this.occurredOn = new Date();
    this.payload = payload;
  }

  abstract get eventName(): string;
}
```

---

## Event Example

```typescript
interface OrderCreatedPayload {
  orderId: string;
  userId: string;
  totalAmount: number;
}

export class OrderCreatedEvent extends DomainEvent<OrderCreatedPayload> {
  get eventName(): string { return 'order.created'; }

  static create(payload: OrderCreatedPayload): OrderCreatedEvent {
    return new OrderCreatedEvent(payload);
  }
}
```

---

## Entity with Events

Located in `src/core/entities/entity-with-events.ts`

```typescript
export abstract class EntityWithEvents<T> extends Entity<T> {
  private _domainEvents: DomainEvent[] = [];

  get domainEvents(): DomainEvent[] { return this._domainEvents; }

  protected addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  public clearDomainEvents(): void { this._domainEvents = []; }
  public hasDomainEvents(): boolean { return this._domainEvents.length > 0; }
}
```

---

## Usage

```typescript
export class Order extends EntityWithEvents<OrderProps> {
  public static create(props: OrderProps, id?: string): Order {
    const order = new Order({ ...props, status: OrderStatus.PENDING }, id);

    order.addDomainEvent(OrderCreatedEvent.create({
      orderId: order.id,
      userId: order.userId,
      totalAmount: order.totalAmount,
    }));

    return order;
  }

  public markAsPaid(paymentId: string): void {
    this.props.status = OrderStatus.PAID;
    this.addDomainEvent(OrderPaidEvent.create({ orderId: this.id, paymentId }));
  }
}
```
