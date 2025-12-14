# Mapper Pattern

> Prisma ↔ Domain conversion. Located in `src/infra/persistence/prisma/mapper/`

---

## Structure

Mappers convert between Prisma models and domain entities, following standard patterns:

```typescript
import { Entity } from '@/domain/module/entity';
import { Prisma, Entity as PrismaEntity } from '@prisma/client';

// Type definition for Prisma entity with relations
type PrismaEntityWithRelations = PrismaEntity & {
  relatedEntity?: PrismaRelatedEntity | null;
  otherRelations?: PrismaOtherEntity[];
};

export class PrismaEntityMapper {
  /**
   * Convert Prisma model to Domain entity (full)
   * Includes related entities when eager-loaded
   */
  static toDomain(prismaEntity: PrismaEntityWithRelations): Entity {
    return Entity.create(
      {
        name: prismaEntity.name,
        status: prismaEntity.status as EntityStatus,
        relatedData: prismaEntity.relatedEntity
          ? PrismaRelatedEntityMapper.toDomain(prismaEntity.relatedEntity)
          : undefined,
        otherData: prismaEntity.otherRelations
          ? PrismaOtherEntityMapper.toDomainArray(prismaEntity.otherRelations)
          : [],
      },
      prismaEntity.id,
    );
  }

  /**
   * Convert Prisma model to Domain entity (without nested relations)
   * Use to prevent circular references
   */
  static toDomainSimple(prismaEntity: PrismaEntity): Entity {
    return Entity.create(
      {
        name: prismaEntity.name,
        status: prismaEntity.status as EntityStatus,
        relatedData: undefined,
        otherData: [],
      },
      prismaEntity.id,
    );
  }

  /**
   * Convert Domain entity to Prisma create input
   */
  static toPrisma(entity: Entity): Prisma.EntityUncheckedCreateInput {
    return {
      id: entity.id,
      name: entity.name,
      status: entity.status,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  /**
   * Convert Domain entity to Prisma update input
   */
  static toPrismaUpdate(entity: Partial<Entity>): Prisma.EntityUpdateInput {
    const data: Prisma.EntityUpdateInput = {};

    if (entity.name !== undefined) data.name = entity.name;
    if (entity.status !== undefined) data.status = entity.status;
    if (entity.updatedAt !== undefined) data.updatedAt = entity.updatedAt;

    return data;
  }

  /**
   * Convert array of Prisma models to Domain entities
   */
  static toDomainArray(prismaEntities: PrismaEntityWithRelations[]): Entity[] {
    return prismaEntities.map((e) => PrismaEntityMapper.toDomain(e));
  }
}
```

---

## Methods

| Method | Purpose |
|--------|---------|
| `toDomain()` | Full conversion with nested relations |
| `toDomainSimple()` | Without nested to prevent circular refs |
| `toPrisma()` | Domain → Prisma create input |
| `toPrismaUpdate()` | Domain → Prisma update input |
| `toDomainArray()` | Batch conversion |
| `toPrismaCreate()` | Specialized methods for complex nested creates |
