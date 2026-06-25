---
title: Weekly Plan Activity Title And Description
description: Specification for changing Weekly Plan activities from single text entries to title plus optional description
createdAt: '2026-06-24T13:23:18.567Z'
updatedAt: '2026-06-24T13:54:24.102Z'
tags:
  - spec
  - approved
  - weekly-plan
  - schedule
  - api
---

## Overview

Weekly Plan schedule block activities currently use a single `text` field. This change updates activities to use a required `title` and an optional `description`, so callers can display a concise activity name plus supporting detail while preserving existing ordered activity behavior.

This is a breaking Weekly Plan API contract change. The previous activity request shape `{ text }` will no longer be accepted after this change. Existing stored activity text must be preserved by migrating it into `title` with `description: null`.

This spec amends @doc/specs/weekly-plan-daily-schedule and the implemented backend contract documented in @doc/backend-handoff/weekly-plan-daily-schedule-backend-handoff.

## Locked Decisions

- D1: Weekly Plan activities use `{ title: string, description?: string | null }`, with `title` required and `description` optional/clearable.
- D2: This is a breaking API contract change. Weekly Plan activity requests no longer accept `{ text }`; callers must send `{ title, description? }`.
- D3: Existing stored `weekly_plan_activity.text` values are migrated into `title`, and `description` is set to `null`.
- D4: Activity `title` keeps the current 500-character max and is required/non-blank after trim; `description` is optional/clearable, trimmed when present, and capped at 2000 characters.
- D5: Weekly Plan activity responses always include `description`, using `description: null` when no description is set.

## Requirements

### Functional Requirements

- FR-1: Weekly Plan activity request objects must use `title` and optional `description` fields instead of `text`.
- FR-2: Create and update Weekly Plan schedule payloads must reject activity objects that omit `title`, provide blank `title`, or provide a non-string `title`.
- FR-3: Create and update Weekly Plan schedule payloads must reject legacy activity objects that only provide `text`.
- FR-4: The backend must trim `title`; blank trimmed titles are invalid; non-empty trimmed titles must not exceed 500 characters.
- FR-5: The backend must trim `description` when provided; omitted, `null`, or blank descriptions must normalize to `null`; non-empty trimmed descriptions must not exceed 2000 characters.
- FR-6: Weekly Plan responses from create, update, get by ID, list, active lookup, copy, archive, and restore flows must return each activity as `{ order, title, description }`.
- FR-7: Weekly Plan responses must always include `description`, with `null` when the activity has no description.
- FR-8: Existing activity ordering behavior must be preserved; the backend continues deriving request activity order from array position unless an internal/domain order is already present.
- FR-9: Existing stored Weekly Plan activity data must be migrated by copying each activity's current `text` value into `title` and setting `description` to `null`.
- FR-10: The old persisted `text` field must not remain part of the public Weekly Plan activity contract after migration.
- FR-11: Weekly Plan copy behavior must preserve both `title` and `description` for copied activities.
- FR-12: OpenAPI/Swagger DTO documentation must describe the new request and response shapes.

### Non-Functional Requirements

- NFR-1: The migration must preserve all existing Weekly Plan activity content by moving current `text` values into `title`.
- NFR-2: Existing Weekly Plan validation behavior unrelated to activity text shape must remain unchanged, including block time validation, day validation, overlap validation, and activity ordering.
- NFR-3: The change must keep Weekly Plan API responses deterministic and backward-incompatible in a clear, documented way.

## Acceptance Criteria

- [x] AC-1: Creating a Weekly Plan with activities shaped as `{ "title": "Morning Meeting", "description": "Greeting and calendar" }` succeeds and returns activities with `order`, `title`, and `description`.
- [x] AC-2: Creating or updating a Weekly Plan with `{ "title": "Morning Meeting" }`, omitted `description`, or `description: null` succeeds and returns `description: null`.
- [x] AC-3: Creating or updating a Weekly Plan with blank or whitespace-only `title` fails validation.
- [x] AC-4: Creating or updating a Weekly Plan with `title` longer than 500 characters fails validation.
- [x] AC-5: Creating or updating a Weekly Plan with `description` longer than 2000 characters fails validation.
- [x] AC-6: Creating or updating a Weekly Plan with legacy `{ "text": "Morning Meeting" }` and no `title` fails validation.
- [x] AC-7: Existing database rows created before the change retain their visible activity text as `title` after migration and return `description: null`.
- [x] AC-8: Copying a Weekly Plan preserves activity `title`, `description`, and order in the copied plan.
- [x] AC-9: List, get by ID, active lookup, create, update, copy, archive, and restore response DTOs expose the same activity shape: `{ order, title, description }`.
- [x] AC-10: Focused tests cover activity normalization, legacy payload rejection, migration/backfill behavior where practical, and response mapping.

## Scenarios

### Scenario 1: Create Activity With Title And Description

**Given** an authorized staff user creates a Weekly Plan with a valid block
**When** the block includes an activity `{ "title": "Morning Meeting", "description": "Greeting, calendar, and weather" }`
**Then** the backend stores the activity title and description and returns `{ "order": 0, "title": "Morning Meeting", "description": "Greeting, calendar, and weather" }`.

### Scenario 2: Create Activity Without Description

**Given** an authorized staff user creates or updates a Weekly Plan with a valid block
**When** the block includes an activity `{ "title": "Centers" }`
**Then** the backend stores the activity with `description: null` and returns `description: null` in the response.

### Scenario 3: Reject Legacy Activity Text Shape

**Given** a caller sends a Weekly Plan create or update request
**When** an activity is shaped as `{ "text": "Morning Meeting" }` without `title`
**Then** the backend rejects the request as invalid instead of mapping `text` to `title` at the API boundary.

### Scenario 4: Migrate Existing Activity Text

**Given** an existing stored Weekly Plan activity has `text = "Morning Meeting"`
**When** the migration for this change is applied
**Then** the activity has `title = "Morning Meeting"` and `description = null`, and subsequent API responses expose `title` and `description` instead of `text`.

### Scenario 5: Copy Weekly Plan With Described Activities

**Given** an active Weekly Plan contains an activity with `title` and `description`
**When** the plan is copied to another class or week
**Then** the copied activity preserves the same `title`, `description`, and relative order.

## Technical Notes

- Current implementation stores `WeeklyPlanActivity` as `order` plus `text`; this change requires persistence, domain, mapper, DTO, OpenAPI, and tests to move to `title` plus nullable `description`.
- The migration should backfill `title` from existing `text` before removing or replacing the old persisted text column.
- This spec intentionally does not add rich text, localization, attachments, activity-level times, or activity-level IDs to the public API.

## Open Questions

None.
