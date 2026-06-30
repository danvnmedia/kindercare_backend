---
title: Read Projection Patterns
description: Patterns for read-side DTO projections, derived list aggregates, relation snapshots, and Prisma view-backed computed fields without polluting domain aggregates.
createdAt: '2026-05-31T02:12:09.368Z'
updatedAt: '2026-06-25T16:35:09.959Z'
tags:
  - patterns
  - read-projection
  - clean-architecture
  - dto
  - mapper
  - prisma
---

# Read Projection Patterns

Use these patterns when an API response needs read-only display data that is not part of the core aggregate mutation model.

## Choosing A Projection Shape

| Need | Pattern |
| --- | --- |
| Parent aggregate needs a small related summary such as `{ id, name }` | Related snapshot on the domain entity |
| Paginated list needs counts or preview rows beside the aggregate | Flat list item view after `PrismaQueryService.executeQuery(..., null)` |
| Field is derived/computed by SQL, such as lifecycle phase or tier | Prisma view binding for read paths |

The common rule: keep writes in the normal aggregate/repository path, and shape read data deliberately at the boundary that owns the projection.

## Related Snapshot On An Aggregate

Use a snapshot when the read side only needs a few fields from a related aggregate.

Example shape:

```ts
export interface StaffTypeSnapshot {
  id: string;
  name: string;
}
```

How to apply:

1. Define `XxxSnapshot` beside the parent entity.
2. Add the nullable snapshot to props and expose a getter.
3. Include it in the factory optional defaults, usually as `null`.
4. Hydrate it only when the repository includes the relation.
5. Keep write methods based on the foreign key; do not mutate the snapshot from domain methods.
6. Create a shared response DTO such as `XxxSummaryDto` with `@Expose()` and `@ApiProperty()`.

Use this instead of carrying the full related domain entity when the use case only needs display fields.

## Derived Aggregate List Items

When a paginated list endpoint needs counts or preview rows, avoid returning tuples such as `{ entity, aggregate }`. The standard response interceptor transforms each element against the response DTO, so top-level field names must match the DTO.

Repository pattern:

```ts
const result = await this.queryService.executeQuery<RawRow>(
  this.prisma,
  "class",
  params,
  {
    include: {
      _count: { select: { enrollments: true } },
      staff: { include: { staff: true } },
    },
    scope: { campusId },
  },
  null,
);

return {
  data: result.data.map((row) => ({
    id: row.id,
    name: row.name,
    studentCount: row._count.enrollments,
    staffPreview: row.staff.map(toStaffPreview),
  })),
  pagination: result.pagination,
};
```

Steps:

1. Pass `null` as the mapper class to `PrismaQueryService.executeQuery` so pagination, filter, sort, and scope still run centrally while raw Prisma rows are returned.
2. Map `result.data` to a flat view interface co-located with the repository port.
3. Return `PaginatedResult<XxxListItemView>` from the port.
4. Let the use case pass through the result.
5. Create `XxxListItemResponse extends XxxResponse` or a dedicated list-item DTO with every projected field exposed.

This keeps the domain aggregate clean while preserving the standard response envelope and pagination behavior.

## Prisma View Binding For Computed Fields

When a field is computed from database state, bind read paths to a Prisma view and keep writes on the base model.

Pattern:

1. Add a Prisma `view XxxWithComputedField` block that mirrors the base columns plus the computed field. Enable Prisma's views preview feature where required.
2. Create the SQL view in the migration.
3. Repository reads use `prisma.xxxWithComputedField.findMany/findFirst/findUnique/count`.
4. Repository writes continue using `prisma.xxx.create/update/delete`.
5. Mapper accepts a union row type such as `(PrismaXxx | PrismaXxxWithComputedField) & { relations? }`.
6. Narrow the computed field with the `in` operator before assigning it to an optional domain prop.
7. The computed domain prop remains optional because post-write reads from the base table may not include it.

This avoids adding view-only relations to unrelated Prisma models and keeps the view read-only.

## DTO And Interceptor Rules

- Response DTOs must expose every projected field with `@Expose()`.
- Nested summaries should use shared DTOs with `@Type(() => SummaryDto)`.
- Paginated list data should be a flat array of objects that already match the DTO shape.
- Keep projection interfaces near the port that returns them.
- Do not put projection-only fields into update request DTOs.

## References

- @doc/patterns/standard-response-pattern
- @doc/patterns/mapper-pattern
- @doc/patterns/repository-pattern

Related implementation precedents:

- Student status list work established that query-derived status belongs in read projections, SQL views, or mappers when it is presentation state rather than a domain invariant.
- Current-class surfacing established that relation snapshots are appropriate for read DTOs when the UI needs enrollment context without expanding the aggregate boundary.
