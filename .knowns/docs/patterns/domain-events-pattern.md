---
title: Domain Events Pattern
createdAt: '2026-01-03T19:52:33.562Z'
updatedAt: '2026-01-03T20:28:19.781Z'
description: Event-driven workflows pattern
tags:
  - patterns
  - events
  - domain
---
# Domain Events Pattern

> Event-driven workflows. Located in src/domain/{module}/events/

---

## Base Event

DomainEvent<T> provides:
- occurredOn: Date (when event was created)
- payload: T (event data)
- abstract eventName: string (e.g., 'order.created')

---

## Creating Events

1. Define payload interface with event data
2. Extend DomainEvent with payload type
3. Implement eventName getter
4. Add static create() factory method

---

## Entity with Events

EntityWithEvents<T> extends Entity<T> with:
- Private _domainEvents array
- addDomainEvent(event): Adds event to queue
- clearDomainEvents(): Clears queue after dispatch
- hasDomainEvents(): Checks if events pending

---

## Usage

1. Entity extends EntityWithEvents<Props>
2. In entity methods, call addDomainEvent() for state changes
3. Repository dispatches events after persistence
4. Event handlers process events asynchronously

---

## Example Flow

1. Order.create() adds OrderCreatedEvent
2. orderRepository.save() persists order
3. Repository dispatches all domain events
4. OrderEventHandlers.handleOrderCreated() runs
5. order.clearDomainEvents() clears queue
