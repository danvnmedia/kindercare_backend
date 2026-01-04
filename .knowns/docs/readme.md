---
title: README
createdAt: '2026-01-03T19:51:45.975Z'
updatedAt: '2026-01-03T19:53:02.849Z'
description: Code Standards & Patterns for Clean Architecture - Main documentation index
tags:
  - index
  - overview
---
# Example Backend - Documentation

> Code Standards & Patterns for Clean Architecture

---

## Architecture

| Layer | Location | Purpose |
|-------|----------|---------|
| Domain | src/domain/ | Entities, Value Objects, Domain Events |
| Application | src/application/ | Use Cases, Ports, Event Handlers |
| Infrastructure | src/infra/ | Controllers, Repositories, Mappers, Guards |
| Core | src/core/ | Base classes, Exceptions, Validators |

---

## Patterns

| # | Pattern | Doc |
|---|---------|-----|
| 1 | Mapper | @doc/patterns/mapper-pattern |
| 2 | Controller | @doc/patterns/controller-pattern |
| 3 | Use Case | @doc/patterns/use-case-pattern |
| 4 | Repository | @doc/patterns/repository-pattern |
| 5 | DTO | @doc/patterns/dto-pattern |
| 6 | Entity | @doc/patterns/entity-pattern |
| 7 | Value Object | @doc/patterns/value-object-pattern |
| 8 | Module | @doc/patterns/module-pattern |
| 9 | Exception | @doc/patterns/exception-pattern |
| 10 | Domain Events | @doc/patterns/domain-events-pattern |
| 11 | Event Handler | @doc/patterns/event-handler-pattern |
| 12 | Guards | @doc/patterns/guards-pattern |
| 13 | Decorators | @doc/patterns/decorators-pattern |
| 14 | Unit of Work | @doc/patterns/unit-of-work-pattern |
| 15 | Validation | @doc/patterns/validation-pattern |

---

## Conventions

| Topic | Doc |
|-------|-----|
| Naming | @doc/conventions/naming-conventions |
| Checklist | @doc/conventions/implementation-checklist |

---

## Guides

| Topic | Doc |
|-------|-----|
| Pagination and Filtering | @doc/guides/pagination-and-filtering |
| Code Generation | @doc/guides/code-generation-pattern |
