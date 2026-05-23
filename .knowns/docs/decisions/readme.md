---
title: Decisions — Folder Index
description: 'Landing page for the `decisions/` folder. Index of all ADR-style decision records captured in this folder. Each entry summarizes the decision in one line and links to the full ADR.'
createdAt: '2026-05-23T15:32:25.615Z'
updatedAt: '2026-05-23T15:32:31.474Z'
tags:
  - decision
  - adr
  - index
  - folder-index
---

# Decisions — Folder Index

Landing page for the `decisions/` folder. Each entry below is an ADR-style record: a single architectural or product decision, the *why*, the trade-offs, and the consequences. Decisions live in this folder rather than under `architecture/` to keep "why we made this call" cleanly separable from "how the system is structured today".

## ADR Format

Each decision doc follows the standard ADR shape:

1. **Status** (Accepted / Superseded / Deprecated)
2. **Context** — what state of the world made this decision necessary
3. **Decision** — the choice that was made, in plain terms
4. **Consequences** — what becomes possible, what becomes harder, what we accept
5. (Optional) **Return path** — under what conditions the decision should be revisited
6. **References** — links to the implementation spec, related ADRs, and downstream docs

Decision docs reference the implementation spec at `@doc/specs/<name>`; the spec references the decision doc back. The pair forms a closed loop: the spec captures *what* and *how*, the ADR captures *why* and *when revisit*.

## Index

| ADR | Status | One-line summary |
|---|---|---|
| [@doc/decisions/subject-removal](decisions/subject-removal) | Accepted | Dropped the `Subject` domain entirely and reshaped `ClassStaff` around a 3-value Vietnamese-kindergarten-appropriate role enum (`HOMEROOM`, `ASSISTANT`, `BOARDING`). Implementation spec: [@doc/specs/subject-removal-classstaff-role-refactor](specs/subject-removal-classstaff-role-refactor). |

## When to add a new ADR

Create a new entry here when a change carries a *decision* that future-you (or future-teammate) will need to re-derive without it:

- A domain model is removed, renamed, or restructured in a non-obvious way.
- An invariant is chosen over an alternative (e.g. "exactly one HOMEROOM per class" vs "no constraint").
- An external dependency, library, or pattern is adopted, replaced, or rejected.
- A trade-off is locked (performance vs simplicity, breaking vs deprecation window, write-time vs read-time).

Do **not** create an ADR for routine implementation choices, refactors that touch nothing semantically, or decisions already fully captured in a feature spec. The bar is "would I redo this badly if I forgot the rationale?".
