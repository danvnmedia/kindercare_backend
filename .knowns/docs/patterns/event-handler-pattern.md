---
title: Event Handler Pattern
createdAt: '2026-01-03T19:52:35.174Z'
updatedAt: '2026-01-03T20:28:51.366Z'
description: Async event processing pattern
tags:
  - patterns
  - events
  - handler
---
# Event Handler Pattern

> Async event processing. Located in src/application/{module}/event-handlers/

---

## Dispatcher

DomainEventDispatcher provides:
- handlers: Map of event name to handler functions
- register<T>(eventName, handler): Registers handler for event
- dispatch<T>(event): Dispatches to all registered handlers

Handlers run in parallel via Promise.all.

---

## Handler Implementation

1. Inject DomainEventDispatcher and any required services
2. Call registerHandlers() in constructor
3. For each event type, register handler with eventName
4. Handler methods receive event and can perform async operations

---

## Publishing from Repository

After persistence operations:
1. Save/update entity in database
2. Loop through entity.domainEvents
3. Dispatch each event via eventDispatcher.dispatch()
4. Call entity.clearDomainEvents()
5. Return mapped domain entity

---

## Key Points

1. Events dispatched AFTER successful persistence
2. Handlers run asynchronously
3. Multiple handlers can respond to same event
4. Use .bind(this) when registering instance methods
5. Clear events after dispatch to prevent re-processing
