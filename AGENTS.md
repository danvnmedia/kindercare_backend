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

### 4. Task Management - Backlog CLI Tool

> Task management via CLI. **NEVER edit task files directly** - use CLI commands only.

---

## Overview

- Tasks location: `backlog/tasks/task-<id> - <title>.md`
- Use `--plain` flag for AI-friendly output
- CLI handles Git, metadata, file naming

---

## Critical Rule

```
DO:    backlog task edit, backlog task create
DON'T: Edit .md files directly
```

---

## Quick Reference

### Task Operations

| Action | Command |
|--------|---------|
| List | `backlog task list --plain` |
| View | `backlog task 42 --plain` |
| Search | `backlog search "topic" --plain` |
| Create | `backlog task create "Title" -d "Desc" --ac "AC1"` |
| Edit | `backlog task edit 42 -s "In Progress" -a me` |
| Check AC | `backlog task edit 42 --check-ac 1` |
| Add notes | `backlog task edit 42 --notes "Done"` |
| Add plan | `backlog task edit 42 --plan "1. Step"` |

---

## Workflow

```bash
# 1. Find work
backlog task list -s "To Do" --plain

# 2. Start task
backlog task edit 42 -s "In Progress" -a @myself

# 3. Add plan
backlog task edit 42 --plan "1. Research\n2. Implement"

# 4. Work & check ACs
backlog task edit 42 --check-ac 1 --check-ac 2

# 5. Add notes & complete
backlog task edit 42 --notes "Implemented X"
backlog task edit 42 -s Done
```

---

## Definition of Done

1. All ACs checked via CLI
2. Implementation notes added
3. Status set to Done
4. Tests pass
5. Code reviewed

---

## Task Structure

```markdown
---
id: task-42
title: Feature Name
status: To Do
assignee: [user]
labels: [backend]
---

## Description
Why this task exists.

## Acceptance Criteria
- [ ] #1 First criterion
- [ ] #2 Second criterion

## Implementation Plan
1. Step one
2. Step two

## Implementation Notes
What was done.
```

---

## Task Field Commands

| Field | Command |
|-------|---------|
| Title | `backlog task edit 42 -t "New Title"` |
| Status | `backlog task edit 42 -s "In Progress"` |
| Assignee | `backlog task edit 42 -a user` |
| Labels | `backlog task edit 42 -l backend,api` |
| Description | `backlog task edit 42 -d "New desc"` |
| Add AC | `backlog task edit 42 --ac "New criterion"` |
| Check AC | `backlog task edit 42 --check-ac 1` |
| Remove AC | `backlog task edit 42 --remove-ac 2` |
| Plan | `backlog task edit 42 --plan "Steps"` |
| Notes | `backlog task edit 42 --notes "Summary"` |
| Append notes | `backlog task edit 42 --append-notes "More"` |

---

## Creating Tasks

```bash
backlog task create "Title" \
  -d "Description" \
  --ac "Criterion 1" \
  --ac "Criterion 2" \
  -l backend \
  --priority high
```

### Good ACs (Outcome-focused)
- "User can log in with valid credentials"
- "API returns 200 with correct data"

### Bad ACs (Implementation steps)
- "Add function handleLogin()"

---

## Implementing Tasks

### Phase Discipline

1. **Creation**: Title, Description, ACs, labels
2. **Start**: Set In Progress, assign, add plan
3. **Work**: Implement, check ACs as completed
4. **Wrap-up**: Add notes (PR description), mark Done

### Steps

```bash
# 1. Start
backlog task edit 42 -s "In Progress" -a @myself

# 2. Plan (ask user approval before coding)
backlog task edit 42 --plan "1. Research\n2. Implement"

# 3. After approval, implement & check ACs
backlog task edit 42 --check-ac 1

# 4. Complete
backlog task edit 42 --notes "Implemented using X pattern"
backlog task edit 42 -s Done
```

---

## Multi-line Input

```bash
# Bash/Zsh
backlog task edit 42 --plan '1. Step\n2. Step'

# POSIX
backlog task edit 42 --notes "$(printf 'Line1\nLine2')"
```

---

## Common Issues

| Problem | Solution |
|---------|----------|
| Task not found | `backlog task list --plain` |
| AC wrong index | `backlog task 42 --plain` to see numbers |
| Changes not saving | Use CLI, not file editing |

---

## Golden Rule

**Change anything in a task = use `backlog task edit`**

Full help: `backlog --help`
