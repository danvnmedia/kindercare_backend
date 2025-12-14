# Unit of Work Pattern

> Transaction management. Located in `src/infra/persistence/prisma/`

---

## Port

```typescript
export abstract class UnitOfWorkPort {
  abstract run<T>(task: () => Promise<T>): Promise<T>;
}
```

---

## Implementation

```typescript
@Injectable()
export class PrismaUnitOfWork extends UnitOfWorkPort {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async run<T>(task: () => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async () => task());
  }
}
```

---

## Usage

```typescript
@Injectable()
export class CreateOrderUseCase {
  constructor(
    private readonly unitOfWork: UnitOfWorkPort,
    private readonly orderRepository: OrderRepository,
    private readonly ticketRepository: TicketRepository,
  ) {}

  async execute(command: CreateOrderCommand): Promise<Order> {
    return this.unitOfWork.run(async () => {
      // Validate stock
      const tickets = await this.ticketRepository.findByIds(command.ticketIds);
      for (const ticket of tickets) {
        if (ticket.stock < command.quantities[ticket.id]) {
          throw new OutOfStockException(ticket.id);
        }
      }

      // Create order
      const order = Order.create({ /* ... */ });
      await this.orderRepository.save(order);

      // Decrement stock
      for (const ticket of tickets) {
        await this.ticketRepository.decrementStock(ticket.id, command.quantities[ticket.id]);
      }

      return order;
    });
  }
}
```

All operations succeed or all fail together.
