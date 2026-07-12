---
title: 2026-07-11 CMS API Contract Alignment
description: Approved backend specification for aligning CMS and file-upload wire contracts with the frontend audit.
createdAt: '2026-07-10T20:28:32.182Z'
updatedAt: '2026-07-12T05:41:45.498Z'
tags:
  - spec
  - approved
  - cms
  - api
---

# CMS API Contract Alignment

Status: approved

Source: frontend CMS API alignment audit dated 2026-07-11.

## Release hardening acceptance criteria — 2026-07-12

- [x] AC-8: Scheduled posts remain invisible and non-engageable before publishAt.
- [x] AC-9: Transition authorization is action-specific and post.manage supports public-comment moderation.
- [x] AC-10: Public comment replies reject non-public parents and deleted content is masked in API responses.
- [x] AC-11: Embedded post attachments include usable read URLs across list, detail, transition, and attachment responses.
- [x] AC-12: File deletion separates owner and elevated authority, protects attached files, and upload completion cannot race stale cleanup.
- [x] AC-13: Targeted regression tests, build, and SDD validation pass.
