---
title: Prisma Migration Patterns
description: Prisma and PostgreSQL migration rules for hand-written SQL, raw inserts, NULL handling, soft-archive uniqueness, and non-interactive migration workflows.
createdAt: '2026-05-31T02:11:42.340Z'
updatedAt: '2026-06-25T16:35:05.447Z'
tags:
  - patterns
  - prisma
  - migration
  - postgres
  - raw-sql
  - schema
---

# Prisma Migration Patterns

This doc captures migration rules that have caused real failures in this backend. Use it when hand-writing Prisma migrations, writing raw SQL seeds/backfills, or modeling uniqueness that Prisma schema annotations cannot express directly.

## Schema Annotation Defaults

When a hand-written migration creates or alters a table, the SQL defaults must match what Prisma schema annotations imply.

| Prisma schema annotation | SQL default convention |
| --- | --- |
| `id String @id @default(uuid()) @db.Uuid` | No database default. The Prisma client generates the UUID unless the schema explicitly uses `dbgenerated(...)`. Do not add `DEFAULT gen_random_uuid()` by habit. |
| `createdAt DateTime @default(now()) @map("created_at")` | Database default such as `DEFAULT CURRENT_TIMESTAMP`. |
| `updatedAt DateTime @updatedAt @map("updated_at")` | No database default. Prisma manages this field on client writes. |

A mismatch can surface as a misleading shadow-database error such as `P3006 / P1014: model not available`. Treat that error as a possible schema-vs-DDL drift signal, especially after hand-written SQL.

## Raw SQL Inserts And `@updatedAt`

Raw SQL bypasses Prisma's `@updatedAt` behavior. Any raw insert into a table with an `@updatedAt` field must explicitly set both timestamps.

```sql
INSERT INTO "campus" (id, name, created_at, updated_at)
VALUES ($1, $2, now(), now());
```

`created_at` may have a database default, but `updated_at` does not. Omitting it causes a PostgreSQL not-null violation.

Use this rule for:

- seed scripts that call `prisma.$executeRawUnsafe`
- migration backfills that insert rows
- test setup that inserts records through raw SQL

## Non-Interactive Data-Loss Migrations

`prisma migrate dev` refuses non-interactive environments when the diff has a data-loss warning. `--create-only` and piping `y` into stdin do not bypass this, because the guard checks TTY interactivity.

Workaround:

```bash
npx prisma migrate diff --from-schema-datasource ./prisma/schema.prisma --to-schema-datamodel ./prisma/schema.prisma --script
```

Then:

1. Create `prisma/migrations/<YYYYMMDDHHMMSS>_<name>/migration.sql` manually using a UTC timestamp later than the latest migration folder.
2. Paste the reviewed SQL from the diff output.
3. Run `npx prisma migrate deploy`.

Caveats:

- `--from-schema-datasource` reads the datasource URL through `schema.prisma` and `.env`.
- This skips the shadow-database safety pass from `migrate dev`; only use it after reviewing the diff.
- The generated SQL still fits normal Prisma migration history once committed.

## PostgreSQL `UPDATE ... FROM` Target Alias Scope

In PostgreSQL, the target table alias in an `UPDATE ... FROM` statement is not visible inside the `FROM` clause join condition.

Do not write:

```sql
UPDATE "enrollment" e
SET school_year_enrollment_id = np.id
FROM new_parents np
JOIN "class" c ON c.id = e.class_id
WHERE e.student_id = np.student_id;
```

The target alias `e` is only visible to the top-level `SET` and `WHERE`. Use comma-separated `FROM` entries and put predicates in `WHERE`:

```sql
UPDATE "enrollment" e
SET school_year_enrollment_id = np.id
FROM new_parents np, "class" c
WHERE c.id = e.class_id
  AND e.student_id = np.student_id;
```

## `NULLS NOT DISTINCT` Uniqueness

PostgreSQL 15+ can enforce uniqueness where `NULL` values compare as equal using `NULLS NOT DISTINCT`. Prisma `@@unique` cannot express this clause.

For a full-table unique key where Prisma Client should still infer a typed compound key:

1. Keep the matching `@@unique([...])` in `schema.prisma` for Prisma Client type generation.
2. In the same migration, drop the Prisma-generated unique index.
3. Recreate the index using raw SQL with `NULLS NOT DISTINCT` and a stable hand-chosen index name.
4. Add a schema comment above `@@unique` explaining that SQL-level semantics are replaced by raw migration SQL.

Example shape:

```sql
DROP INDEX IF EXISTS "user_roles_user_id_role_id_campus_id_key";

CREATE UNIQUE INDEX "user_roles_unique_assignment"
ON "user_roles" ("user_id", "role_id", "campus_id") NULLS NOT DISTINCT;
```

Use this when nullable columns are part of the natural key and multiple `NULL` rows must collide.

## Active-Only Uniqueness For Soft Archive

Recoverable entities often need this behavior:

- archived rows remain in the database
- users may create a replacement active row with the same natural key
- restoring the archived row must conflict if a replacement active row exists

That requires an active-only partial unique index rather than global uniqueness.

```sql
CREATE UNIQUE INDEX "meal_menu_active_natural_key"
ON "meal_menu" ("campus_id", "grade_level_id", "week_start_date") NULLS NOT DISTINCT
WHERE "is_archived" = false;
```

Notes:

- Use `NULLS NOT DISTINCT` when nullable target columns are part of the key and `NULL` means a real target, such as whole-campus `grade_level_id = NULL`.
- Prisma cannot express partial unique indexes in `@@unique`; use raw SQL and natural-key `findFirst`/conflict checks where needed.
- Keep restore behavior explicit in the use case: restoring an archived row should check for an active row with the same key and return a conflict.

## Validation Checklist

After migration changes:

```bash
npx prisma validate
npx prisma generate
npm run build
```

For migrations that touch data or raw SQL, also run the relevant focused Jest specs and review generated SQL carefully before commit.

## References

- @doc/architecture/audit-trail-soft-delete-patterns

Related implementation precedents:

- Staff type refactors established that schema changes which split or rename persisted concepts need an explicit data-preservation path before dropping legacy columns.
- Meal menu migrations established the active-only soft-archive uniqueness pattern: use PostgreSQL partial unique indexes for `WHERE is_archived = false` constraints that Prisma cannot express directly.
