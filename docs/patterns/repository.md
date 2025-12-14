# Repository Pattern

> Data access abstraction

---

## Port (Interface)

Located in `src/application/{module}/ports/`

```typescript
import { Entity } from '@/domain/module/entity';
import { StandardRequest, PaginatedResult } from '@/core/modules/standard-response';

export abstract class EntityRepository {
  abstract findById(id: string): Promise<Entity | null>;
  abstract findByEmail(email: string): Promise<Entity | null>;
  abstract findAll(params: StandardRequest): Promise<PaginatedResult<Entity>>;
  abstract save(entity: Entity): Promise<Entity>;
  abstract update(id: string, entity: Partial<Entity>): Promise<Entity>;
  abstract delete(id: string): Promise<void>;
}
```

---

## Implementation

Located in `src/infra/persistence/prisma/repositories/`

```typescript
import { Injectable } from '@nestjs/common';
import { EntityRepository } from '@/application/module/ports/entity.repository';
import { PrismaService } from '../prisma.service';
import { PrismaEntityMapper } from '../mapper/prisma-entity.mapper';
import { StandardRequest, PaginatedResult } from '@/core/modules/standard-response/dto';
import { PrismaQueryService } from '@/core/modules/standard-response/services/prisma-query.service';

@Injectable()
export class PrismaEntityRepository implements EntityRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queryService: PrismaQueryService,
  ) {}

  async findById(id: string): Promise<Entity | null> {
    const entity = await this.prisma.entity.findUnique({
      where: { id },
      include: { createdBy: true, updatedBy: true },
    });
    return entity ? PrismaEntityMapper.toDomain(entity) : null;
  }

  async findAll(params: StandardRequest): Promise<PaginatedResult<Entity>> {
    // Define allowed fields for filtering and sorting
    params.allowedFilterFields = ["field1", "field2", "isArchived"];
    params.allowedSortFields = ["createdAt", "updatedAt", "field1", "field2"];

    // Use PrismaQueryService to execute query with StandardRequest
    return await this.queryService.executeQuery<Entity>(
      this.prisma,
      "entity",
      params,
      {
        include: {
          createdBy: true,
          updatedBy: true,
        },
      },
      PrismaEntityMapper,
    );
  }

  async save(entity: Entity): Promise<Entity> {
    const data = PrismaEntityMapper.toPrisma(entity);
    const created = await this.prisma.entity.create({ data, include: { createdBy: true } });
    return PrismaEntityMapper.toDomain(created);
  }
}
```
