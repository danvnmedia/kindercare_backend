---
title: Module Pattern
createdAt: '2026-01-03T19:52:19.858Z'
updatedAt: '2026-01-03T20:27:57.162Z'
description: NestJS module registration pattern
tags:
  - patterns
  - module
  - nestjs
---
# Module Pattern

> NestJS module registration. Located in src/application/{module}/

---

## Structure

Modules follow this pattern:
- imports: Import dependency modules (PrismaModule, etc.)
- controllers: Register HTTP controllers
- providers: Register use cases and bind repositories
- exports: Export repositories for other modules

---

## Key Points

1. **Imports**: Import dependency modules (PrismaModule, etc.)
2. **Controllers**: Register HTTP controllers
3. **Providers**: Register use cases and bind repositories
4. **Exports**: Export repositories for other modules
5. **Binding**: Abstract class -> Concrete implementation

---

## Repository Binding

Use provide/useClass pattern to bind abstract repositories to implementations:

{
  provide: EntityRepository,
  useClass: PrismaEntityRepository,
}
