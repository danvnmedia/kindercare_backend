# Example Backend - Documentation

> Code Standards & Patterns for Clean Architecture

---

## Architecture

| Layer | Location | Purpose |
|-------|----------|---------|
| Domain | `src/domain/` | Entities, Value Objects, Domain Events |
| Application | `src/application/` | Use Cases, Ports, Event Handlers |
| Infrastructure | `src/infra/` | Controllers, Repositories, Mappers, Guards |
| Core | `src/core/` | Base classes, Exceptions, Validators |

---

## Patterns

| # | Pattern | File |
|---|---------|------|
| 1 | Mapper | [mapper.md](./patterns/mapper.md) |
| 2 | Controller | [controller.md](./patterns/controller.md) |
| 3 | Use Case | [use-case.md](./patterns/use-case.md) |
| 4 | Repository | [repository.md](./patterns/repository.md) |
| 5 | DTO | [dto.md](./patterns/dto.md) |
| 6 | Entity | [entity.md](./patterns/entity.md) |
| 7 | Value Object | [value-object.md](./patterns/value-object.md) |
| 8 | Module | [module.md](./patterns/module.md) |
| 9 | Exception | [exception.md](./patterns/exception.md) |
| 10 | Domain Events | [domain-events.md](./patterns/domain-events.md) |
| 11 | Event Handler | [event-handler.md](./patterns/event-handler.md) |
| 12 | Guards | [guards.md](./patterns/guards.md) |
| 13 | Decorators | [decorators.md](./patterns/decorators.md) |
| 14 | Unit of Work | [unit-of-work.md](./patterns/unit-of-work.md) |
| 15 | Validation | [validation.md](./patterns/validation.md) |

---

## Conventions

| Topic | File |
|-------|------|
| Naming | [naming.md](./conventions/naming.md) |
| Checklist | [checklist.md](./conventions/checklist.md) |

---

## Guides

| Topic | File |
|-------|------|
| Backlog CLI | [backlog.md](./guides/backlog.md) |
| Pagination & Filtering | [pagination-and-filtering.md](./guides/pagination-and-filtering.md) |
| Code Generation | [code-generation.md](./guides/code-generation.md) |

---

**Last Updated**: 2025-12-17
