# Module Pattern

> NestJS module registration. Located in `src/application/{module}/`

---

## Structure

```typescript
import { Module } from '@nestjs/common';
import { EntityController } from './controllers/entity.controller';
import {
  GetAllEntitiesUseCase,
  CreateEntityUseCase,
  UpdateEntityUseCase,
} from '@/application/module/use-cases';
import { EntityRepository } from '@/application/module/ports/entity.repository';
import { PrismaEntityRepository } from '@/infra/persistence/prisma/repositories';
import { PrismaModule } from '@/infra/persistence/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [EntityController],
  providers: [
    // Use Cases
    GetAllEntitiesUseCase,
    CreateEntityUseCase,
    UpdateEntityUseCase,

    // Repository binding (Port → Implementation)
    {
      provide: EntityRepository,
      useClass: PrismaEntityRepository,
    },
  ],
  exports: [EntityRepository],
})
export class EntityModule {}
```

---

## Key Points

1. **Imports**: Import dependency modules (PrismaModule, etc.)
2. **Controllers**: Register HTTP controllers
3. **Providers**: Register use cases and bind repositories
4. **Exports**: Export repositories for other modules
5. **Binding**: Abstract class → Concrete implementation
