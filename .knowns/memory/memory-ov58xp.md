---
id: ov58xp
title: 'Knowns @doc/ reference convention — plain text, no brackets, no backticks'
layer: project
category: convention
tags:
  - docs
  - knowns
  - convention
createdAt: '2026-05-05T17:57:41.200Z'
updatedAt: '2026-05-05T17:57:41.200Z'
---

For cross-references between docs, use plain `@doc/<path>` text — NOT inside markdown link syntax like `[@doc/path](path)` and NOT wrapped in backticks like `` `@doc/path` ``.

**Why:** The Knowns validator parses `@doc/...` patterns greedily. Markdown link wrapping `[label](url)` makes the validator read up through `]` (e.g. `audit-trail-soft-delete-patterns](architecture/audit-trail-soft-delete-patterns`), and trailing backticks become part of the doc name. Both produce false-positive "broken doc" info notes.

**How to apply:** When linking to another doc inside content, write `@doc/architecture/multi-campus-architecture` as a bare token. The Knowns viewer renders it as a clickable link automatically.

Verified by validation on 2026-05-05: README with bare `@doc/...` tokens reports 0 issues; same docs with markdown link wrappers report 100+ info-level broken-ref notes.

Many existing docs in this repo (created during a doc overhaul on 2026-05-05) still use the markdown-link form for ~25 docs and produce ~86 false info notes. Future doc edits should convert these as encountered. Path slugs are also auto-derived from titles by Knowns — picking a path like `architecture/audit-and-soft-delete` with a title "Audit Trail & Soft Delete Patterns" results in the actual stored path `architecture/audit-trail-soft-delete-patterns`.
