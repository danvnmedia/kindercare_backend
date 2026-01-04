---
title: Unit of Work Pattern
createdAt: '2026-01-03T19:52:40.012Z'
updatedAt: '2026-01-03T20:29:28.474Z'
description: Transaction management pattern
tags:
  - patterns
  - transaction
  - persistence
---
# Unit of Work Pattern

> Transaction management. Located in src/infra/persistence/prisma/

---

## Port

UnitOfWorkPort defines:
- abstract run<T>(task: () => Promise<T>): Promise<T>

This wraps multiple operations in a single transaction.

---

## Implementation

PrismaUnitOfWork extends UnitOfWorkPort:
- Injects PrismaService
- run() wraps task in prisma.$transaction()
- All operations succeed or all fail together

---

## Usage

1. Inject UnitOfWorkPort in use case
2. Wrap multiple repository operations in unitOfWork.run()
3. If any operation fails, all are rolled back
4. If all succeed, all are committed

---

## Example: CreateOrderUseCase

1. Start unitOfWork.run()
2. Validate ticket stock
3. Create order
4. Decrement ticket stock
5. Return order

If any step fails, entire transaction rolls back.

---

## Key Benefits

1. **Atomicity**: All operations succeed or fail together
2. **Consistency**: Database remains in valid state
3. **Isolation**: Changes not visible until commit
4. **Durability**: Committed changes persist
