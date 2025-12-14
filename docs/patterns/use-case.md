# Use Case Pattern

> Business logic. Located in `src/application/{module}/use-cases/`

---

## Query Use Case

```typescript
import { Injectable } from '@nestjs/common';
import { EntityRepository } from '../ports/entity.repository';

@Injectable()
export class GetAllEntitiesUseCase {
  constructor(private readonly entityRepository: EntityRepository) {}

  async execute(command: StandardRequest): Promise<PaginatedResult<Entity>> {
    return this.entityRepository.findManyWithPagination(command);
  }
}
```

---

## Command Use Case

```typescript
@Injectable()
export class CreateEntityUseCase {
  constructor(
    private readonly entityRepository: EntityRepository,
    private readonly otherRepository: OtherRepository,
  ) {}

  async execute(command: CreateEntityCommand): Promise<Entity> {
    // 1. Validation
    const existing = await this.entityRepository.findByEmail(command.email);
    if (existing) {
      throw new EmailAlreadyExistsException(command.email);
    }

    // 2. Business rules
    const related = await this.otherRepository.findById(command.relatedId);
    if (!related) {
      throw new RelatedEntityNotFoundException(command.relatedId);
    }

    // 3. Create domain entity
    const entity = Entity.create({
      name: command.name,
      email: Email.create(command.email),
      createdByUserId: command.createdByUserId,
    });

    // 4. Persist
    return this.entityRepository.save(entity);
  }
}
```

---

## Types

| Type | Purpose | Example |
|------|---------|---------|
| Query | Read data | `GetAllEntitiesUseCase` |
| Command | Create/Update/Delete | `CreateEntityUseCase` |
| Complex | Multi-step logic | `EnrollStudentUseCase` |
