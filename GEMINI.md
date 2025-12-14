# Project Instructions

> **IMPORTANT**: These instructions are MANDATORY. Follow them exactly.

---

## Documentation Reference

Before implementing any feature, you MUST read the relevant documentation:

📁 **Documentation**: [docs/README.md](./docs/README.md)

### Required Reading by Task Type

| Task | Must Read |
|------|-----------|
| New feature | [checklist.md](./docs/conventions/checklist.md) |
| Create entity | [entity.md](./docs/patterns/entity.md), [repository.md](./docs/patterns/repository.md) |
| Create API endpoint | [controller.md](./docs/patterns/controller.md), [dto.md](./docs/patterns/dto.md) |
| Business logic | [use-case.md](./docs/patterns/use-case.md) |
| Database mapping | [mapper.md](./docs/patterns/mapper.md) |
| Error handling | [exception.md](./docs/patterns/exception.md) |
| Authentication/Authorization | [guards.md](./docs/patterns/guards.md), [decorators.md](./docs/patterns/decorators.md) |
| Event-driven feature | [domain-events.md](./docs/patterns/domain-events.md), [event-handler.md](./docs/patterns/event-handler.md) |
| Transaction handling | [unit-of-work.md](./docs/patterns/unit-of-work.md) |
| Custom validation | [validation.md](./docs/patterns/validation.md) |
| Value types | [value-object.md](./docs/patterns/value-object.md) |
| Module setup | [module.md](./docs/patterns/module.md) |
| Naming | [naming.md](./docs/conventions/naming.md) |
| Task management | [backlog.md](./docs/guides/backlog.md) |
| Pagination & Filtering | [pagination-and-filtering.md](./docs/guides/pagination-and-filtering.md) |

---

## Mandatory Rules

### 1. Follow Patterns Exactly

- Use the EXACT code structure from documentation
- Do NOT deviate from established patterns
- If unsure, READ the relevant doc file first


### 2. File Locations

| Type | Location |
|------|----------|
| Entity | `src/domain/{module}/` |
| Use Case | `src/application/{module}/use-cases/` |
| Repository Port | `src/application/{module}/ports/` |
| Repository Impl | `src/infra/persistence/prisma/repositories/` |
| Mapper | `src/infra/persistence/prisma/mapper/` |
| Controller | `src/infra/http/controllers/` |
| DTO | `src/infra/http/dtos/` |
| Exception | `src/core/exceptions/` |
| Value Object | `src/core/value-objects/` |

### 3. Before Writing Code

1. Read the relevant pattern documentation
2. Follow the checklist in [checklist.md](./docs/conventions/checklist.md)
3. Use correct naming from [naming.md](./docs/conventions/naming.md)

### 4. Task Management

When working with tasks, use CLI only:

```bash
# NEVER edit task files directly
backlog task list --plain
backlog task edit <id> -s "In Progress"
```

See [backlog.md](./docs/guides/backlog.md) for details.
