---
title: Knowns Workflow Gotchas
description: Knowns workflow conventions and gotchas for doc references, SDD acceptance criteria state, and memory-to-doc consolidation.
createdAt: '2026-05-31T02:12:26.575Z'
updatedAt: '2026-06-25T16:34:48.574Z'
tags:
  - conventions
  - knowns
  - workflow
  - docs
  - sdd
---

# Knowns Workflow Gotchas

Use this doc for Knowns-specific behaviors that affect how agents update tasks, docs, specs, and memory in this repository. Repository-level rules still come from `KNOWNS.md`.

## Doc Reference Syntax

Use bare Knowns doc references in doc content when linking to durable documentation:

```text
@doc/patterns/unit-of-work-pattern
@doc/guides/pagination-and-filtering
```

Do not use spec or work-item references inside durable docs. If a doc needs information from implementation planning, write the relevant rule, decision, or behavior directly in the doc instead of pointing to transient SDD state.

Do not wrap Knowns references in Markdown links or backticks when the intent is for Knowns to resolve the reference.

Avoid wrapping a doc reference like this:

```markdown
[doc reference](patterns/unit-of-work-pattern)
`doc reference`
```

The validator parses Knowns reference tokens directly. Markdown link wrappers or trailing backticks can become part of the parsed path and produce false broken-reference notes.

## SDD Acceptance Criteria Checkboxes

Marking a task done through the MCP task API does not necessarily update visible `- [ ] AC-N` checkboxes in the linked spec doc, even when the task has `fulfills: ["AC-N"]` metadata.

The SDD validator may still consider the spec valid through task coverage metadata, so visible checkbox state and validation coverage can drift.

When the rendered spec needs to show completed ACs:

1. Mark the task done with the task API.
2. Read the spec's Acceptance Criteria section.
3. Update that section through the Knowns docs API, not by editing the markdown file directly.
4. Validate the spec or doc after the update.

Example shape:

```json
{
  "action": "update",
  "path": "specs/<name>",
  "section": "Acceptance Criteria",
  "content": "## Acceptance Criteria

- [x] AC-1: ..."
}
```

## Memory Versus Docs

Memory is for short recall. Durable patterns, architecture decisions, API contracts, and reusable workflow rules belong in docs.

Use this split:

| Knowledge type | Put it in |
| --- | --- |
| Durable pattern or convention | Knowns doc |
| Full API contract or frontend handoff | Knowns doc |
| Short pointer to a doc or recent decision | Memory |
| Temporary task state | Task notes |
| Canonical repo behavior | `KNOWNS.md` |

When memory content has been moved into a doc, the memory can be safely deleted if it no longer adds a useful short pointer.

## References

- @doc/patterns/unit-of-work-pattern
- @doc/patterns/prisma-migration-patterns
- @doc/patterns/read-projection-patterns
