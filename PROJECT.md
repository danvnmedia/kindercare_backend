# KinderCare Backend - Code Standards & Patterns

> Standardized code patterns for Clean Architecture implementation.

---

## Quick Reference

| Layer | Location | Purpose |
|-------|----------|---------|
| Domain | `src/domain/` | Entities, Value Objects |
| Application | `src/application/` | Use Cases, Ports |
| Infrastructure | `src/infra/` | Controllers, Repositories, Mappers |
| Core | `src/core/` | Shared utilities, Base classes |

---

## 1. Mapper Pattern

Mappers convert between Prisma models and Domain entities. Located in `src/infra/persistence/prisma/mapper/`.

### Standard Structure

```typescript
import { Entity } from '@/domain/module/entity';
import { Prisma, Entity as PrismaEntity } from '@prisma/client';
import { UniqueEntityID } from '@/core/entities/unique-entity-id';

// Define type for Prisma model with relations
type PrismaEntityWithRelations = PrismaEntity & {
  createdBy?: PrismaUser | null;
  updatedBy?: PrismaUser | null;
  children?: PrismaChild[];
};

export class PrismaEntityMapper {
  /**
   * Convert Prisma model to Domain entity (full)
   * Includes all nested relations
   */
  static toDomain(prismaEntity: PrismaEntityWithRelations): Entity {
    return Entity.create(
      {
        name: prismaEntity.name,
        status: prismaEntity.status as EntityStatus,
        createdAt: prismaEntity.createdAt,
        updatedAt: prismaEntity.updatedAt,
        // Nested relations (use toDomainSimple to prevent circular refs)
        createdBy: prismaEntity.createdBy
          ? PrismaUserMapper.toDomainSimple(prismaEntity.createdBy)
          : undefined,
        updatedBy: prismaEntity.updatedBy
          ? PrismaUserMapper.toDomainSimple(prismaEntity.updatedBy)
          : undefined,
      },
      new UniqueEntityID(prismaEntity.id),
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
        createdAt: prismaEntity.createdAt,
        updatedAt: prismaEntity.updatedAt,
        // No nested relations to prevent circular references
        createdBy: undefined,
        updatedBy: undefined,
      },
      new UniqueEntityID(prismaEntity.id),
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
      createdByUserId: entity.createdByUserId,
      updatedByUserId: entity.updatedByUserId,
    };
  }

  /**
   * Convert Domain entity to Prisma update input
   */
  static toPrismaUpdate(entity: Partial<Entity>): Prisma.EntityUpdateInput {
    const data: Prisma.EntityUpdateInput = {};

    if (entity.name !== undefined) data.name = entity.name;
    if (entity.status !== undefined) data.status = entity.status;

    return data;
  }

  /**
   * Convert array of Prisma models to Domain entities
   */
  static toDomainArray(prismaEntities: PrismaEntityWithRelations[]): Entity[] {
    return prismaEntities.map((prismaEntity) =>
      PrismaEntityMapper.toDomain(prismaEntity),
    );
  }
}
```

### Naming Convention

| Method | Purpose | Return Type |
|--------|---------|-------------|
| `toDomain(entity)` | Full conversion with nested relations | `DomainEntity` |
| `toDomainSimple(entity)` | Without nested to prevent circular refs | `DomainEntity` |
| `toPrisma(entity)` | Domain to Prisma create input | `Prisma.EntityUncheckedCreateInput` |
| `toPrismaUpdate(entity)` | Domain to Prisma update input | `Prisma.EntityUpdateInput` |
| `toDomainArray(entities)` | Batch conversion | `DomainEntity[]` |

---

## 2. Controller Pattern

Controllers handle HTTP concerns only. Located in `src/infra/http/controllers/`.

### Standard Structure

```typescript
import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { UserRole } from '@/domain/user-management/user';
import { EntityRequest, EntityResponse } from '../dtos';
import { StandardResponse } from '@/core/modules/standard-response';
import { StandardRequest } from '@/core/modules/standard-response/dto/standard-request.dto';
import { StandardRequestParam } from '@/core/modules/standard-response/decorators/standard-request-param.decorator';
import {
  GetEntityUseCase,
  GetAllEntitiesUseCase,
  CreateEntityUseCase,
  UpdateEntityUseCase,
  DeleteEntityUseCase,
} from '@/application/module/use-cases';
import { JwtGuard, EmailVerifiedGuard, RoleGuard } from '../guards';
import { Roles } from '../decorators/roles.decorator';
import { User } from '../decorators/user.decorator';
import type { AuthenticatedUser } from '../types/authenticated-user.type';

@ApiTags('Entities')
@ApiBearerAuth('JWT')
@Controller('entities')
@UseGuards(JwtGuard, EmailVerifiedGuard, RoleGuard)
export class EntityController {
  constructor(
    private readonly getEntityUseCase: GetEntityUseCase,
    private readonly getAllEntitiesUseCase: GetAllEntitiesUseCase,
    private readonly createEntityUseCase: CreateEntityUseCase,
    private readonly updateEntityUseCase: UpdateEntityUseCase,
    private readonly deleteEntityUseCase: DeleteEntityUseCase,
  ) {}

  // GET /entities - List with pagination
  @Get()
  @Roles(UserRole.ADMIN)
  @StandardResponse({
    type: EntityResponse,
    message: 'Entities retrieved successfully',
    isPaginated: true,
    allowedSortFields: ['name', 'createdAt', 'updatedAt'],
    allowedFilterFields: ['name', 'status', 'createdAt'],
  })
  @ApiOperation({ summary: 'Get all entities with pagination' })
  async findAll(
    @User() user: AuthenticatedUser,
    @StandardRequestParam() params: StandardRequest,
  ) {
    return this.getAllEntitiesUseCase.execute(params);
  }

  // GET /entities/:id - Get by ID
  @Get(':id')
  @Roles(UserRole.USER, UserRole.ADMIN)
  @StandardResponse({
    type: EntityResponse,
    message: 'Entity retrieved successfully',
  })
  @ApiOperation({ summary: 'Get entity by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async findOne(
    @Param('id') id: string,
    @User() currentUser: AuthenticatedUser,
  ) {
    // Authorization check example
    if (currentUser.role === UserRole.USER && currentUser.id !== id) {
      throw new ForbiddenException('Access denied');
    }
    return this.getEntityUseCase.execute({ id });
  }

  // POST /entities - Create
  @Post()
  @Roles(UserRole.ADMIN)
  @StandardResponse({
    type: EntityResponse,
    message: 'Entity created successfully',
  })
  @ApiOperation({ summary: 'Create new entity' })
  @ApiBody({ type: EntityRequest })
  async create(
    @User() user: AuthenticatedUser,
    @Body() dto: EntityRequest,
  ) {
    return this.createEntityUseCase.execute({
      ...dto,
      createdByUserId: user.id,
    });
  }

  // PUT /entities/:id - Full update
  @Put(':id')
  @Roles(UserRole.ADMIN)
  @StandardResponse({
    type: EntityResponse,
    message: 'Entity updated successfully',
  })
  @ApiOperation({ summary: 'Update entity' })
  async update(
    @Param('id') id: string,
    @User() user: AuthenticatedUser,
    @Body() dto: EntityRequest,
  ) {
    return this.updateEntityUseCase.execute({
      id,
      ...dto,
      updatedByUserId: user.id,
    });
  }

  // DELETE /entities/:id
  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @StandardResponse({ message: 'Entity deleted successfully' })
  @ApiOperation({ summary: 'Delete entity' })
  async remove(@Param('id') id: string) {
    return this.deleteEntityUseCase.execute({ id });
  }
}
```

### Key Patterns

1. **Guards**: For Clerk authentication, use `@UseGuards(ClerkAuthGuard)`. For more fine-grained control, add `RolesGuard`.
2. **Roles**: Use `@Roles(UserRole.X)` decorator for authorization
3. **StandardResponse**: Use for consistent API responses
4. **StandardRequestParam**: For pagination, sorting, filtering
5. **User decorator**: Get authenticated user from request

---

## 3. Use Case Pattern

Use cases contain business logic. Located in `src/application/module/use-cases/`.

### Standard Structure

```typescript
import { Injectable } from '@nestjs/common';
import { EntityRepository } from '../ports/entity.repository';
import { Entity } from '@/domain/module/entity';
import {
  StandardRequest,
  PaginatedResult,
} from '@/core/modules/standard-response';

// Simple query use case
@Injectable()
export class GetAllEntitiesUseCase {
  constructor(private readonly entityRepository: EntityRepository) {}

  async execute(command: StandardRequest): Promise<PaginatedResult<Entity>> {
    return this.entityRepository.findManyWithPagination(command);
  }
}

// Use case with business logic
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
    const relatedEntity = await this.otherRepository.findById(command.relatedId);
    if (!relatedEntity) {
      throw new RelatedEntityNotFoundException(command.relatedId);
    }

    // 3. Create domain entity
    const entity = Entity.create({
      name: command.name,
      email: Email.create(command.email),
      status: EntityStatus.ACTIVE,
      relatedId: command.relatedId,
      createdByUserId: command.createdByUserId,
    });

    // 4. Persist
    return this.entityRepository.save(entity);
  }
}
```

### Use Case Types

| Type | Purpose | Example |
|------|---------|---------|
| Query | Read data | `GetAllEntitiesUseCase`, `GetEntityByIdUseCase` |
| Command | Create/Update/Delete | `CreateEntityUseCase`, `UpdateEntityUseCase` |
| Complex | Multi-step business logic | `EnrollStudentUseCase`, `AssignTeacherUseCase` |

---

## 4. Repository Port (Interface)

Repository interfaces define data access contracts. Located in `src/application/module/ports/`.

### Standard Structure

```typescript
import { Entity } from '@/domain/module/entity';
import {
  StandardRequest,
  PaginatedResult,
} from '@/core/modules/standard-response';

export abstract class EntityRepository {
  // Query methods
  abstract findById(id: string): Promise<Entity | null>;
  abstract findByEmail(email: string): Promise<Entity | null>;
  abstract findManyWithPagination(
    params: StandardRequest,
  ): Promise<PaginatedResult<Entity>>;

  // Command methods
  abstract save(entity: Entity): Promise<Entity>;
  abstract update(id: string, entity: Partial<Entity>): Promise<Entity>;
  abstract delete(id: string): Promise<void>;

  // Specialized queries
  abstract findByRelatedId(relatedId: string): Promise<Entity[]>;
  abstract countByStatus(status: string): Promise<number>;
}
```

---

## 5. Repository Implementation

Prisma repository implementations. Located in `src/infra/persistence/prisma/repositories/`.

### Standard Structure

```typescript
import { Injectable } from '@nestjs/common';
import { EntityRepository } from '@/application/module/ports/entity.repository';
import { Entity } from '@/domain/module/entity';
import { PrismaService } from '../prisma.service';
import { PrismaEntityMapper } from '../mapper/prisma-entity.mapper';
import { PrismaQueryService } from '@/core/modules/standard-response';
import {
  StandardRequest,
  PaginatedResult,
} from '@/core/modules/standard-response';

@Injectable()
export class PrismaEntityRepository extends EntityRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly prismaQueryService: PrismaQueryService,
  ) {
    super();
  }

  async findById(id: string): Promise<Entity | null> {
    const entity = await this.prisma.entity.findUnique({
      where: { id },
      include: {
        createdBy: true,
        updatedBy: true,
      },
    });
    return entity ? PrismaEntityMapper.toDomain(entity) : null;
  }

  async findByEmail(email: string): Promise<Entity | null> {
    const entity = await this.prisma.entity.findUnique({
      where: { email },
    });
    return entity ? PrismaEntityMapper.toDomain(entity) : null;
  }

  async findManyWithPagination(
    params: StandardRequest,
  ): Promise<PaginatedResult<Entity>> {
    const { where, orderBy, skip, take } =
      this.prismaQueryService.buildQuery(params);

    const [entities, total] = await Promise.all([
      this.prisma.entity.findMany({
        where,
        orderBy,
        skip,
        take,
        include: {
          createdBy: true,
          updatedBy: true,
        },
      }),
      this.prisma.entity.count({ where }),
    ]);

    return {
      data: PrismaEntityMapper.toDomainArray(entities),
      pagination: {
        total,
        limit: params.limit,
        offset: params.offset,
      },
    };
  }

  async save(entity: Entity): Promise<Entity> {
    const data = PrismaEntityMapper.toPrisma(entity);
    const created = await this.prisma.entity.create({
      data,
      include: {
        createdBy: true,
        updatedBy: true,
      },
    });
    return PrismaEntityMapper.toDomain(created);
  }

  async update(id: string, entity: Partial<Entity>): Promise<Entity> {
    const data = PrismaEntityMapper.toPrismaUpdate(entity);
    const updated = await this.prisma.entity.update({
      where: { id },
      data,
      include: {
        createdBy: true,
        updatedBy: true,
      },
    });
    return PrismaEntityMapper.toDomain(updated);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.entity.delete({ where: { id } });
  }
}
```

---

## 6. DTO Pattern

DTOs for request/response validation. Located in `src/infra/http/dtos/`.

### Request DTO

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsOptional,
  IsEnum,
  IsUUID,
  MinLength,
  MaxLength,
} from 'class-validator';

export class CreateEntityRequest {
  @ApiProperty({ example: 'Entity Name' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'entity@example.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ example: 'ACTIVE', enum: EntityStatus })
  @IsOptional()
  @IsEnum(EntityStatus)
  status?: EntityStatus;

  @ApiPropertyOptional({ example: 'uuid-here' })
  @IsOptional()
  @IsUUID()
  relatedId?: string;
}
```

### Response DTO

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

export class EntityResponse {
  @ApiProperty()
  @Expose()
  id: string;

  @ApiProperty()
  @Expose()
  name: string;

  @ApiProperty()
  @Expose()
  email: string;

  @ApiProperty({ enum: EntityStatus })
  @Expose()
  status: EntityStatus;

  @ApiPropertyOptional()
  @Expose()
  @Type(() => UserResponse)
  createdBy?: UserResponse;

  @ApiProperty()
  @Expose()
  createdAt: Date;

  @ApiProperty()
  @Expose()
  updatedAt: Date;
}
```

### 6.1. Response DTO Transformation

The `StandardResponseInterceptor` automatically handles transformation from Domain Entities to DTOs:

1. **Entity objects** (with `props` and `_id`) are flattened automatically
2. **UniqueEntityID** objects are converted to strings
3. **ValueObjects** are converted via `toPlain()` method
4. **Date objects** are preserved

**Important**: All Response DTO properties must have `@Expose()` decorator because `excludeExtraneousValues: true` is used.

---

## 7. Domain Entity Pattern

Domain entities with factory method. Located in `src/domain/module/`.

### Base Entity Class

Located in `src/core/entities/entity.ts`:

```typescript
import { UniqueEntityID } from './unique-entity-id';

export abstract class Entity<Props> {
  protected props: Props;
  protected _id: UniqueEntityID;

  protected constructor(props: Props, id?: UniqueEntityID) {
    this.props = props;
    this._id = id ?? new UniqueEntityID();
  }

  get id(): string {
    return this._id.toString();
  }

  /**
   * Converts the entity to a plain object for serialization
   */
  public toPlain(): Record<string, any> {
    const plainObject: Record<string, any> = {
      id: this.id,
    };

    const propsObject = this.props as Record<string, any>;
    for (const key in propsObject) {
      if (Object.prototype.hasOwnProperty.call(propsObject, key)) {
        const value = propsObject[key];

        if (
          value &&
          typeof value === 'object' &&
          'toPlain' in value &&
          typeof value.toPlain === 'function'
        ) {
          plainObject[key] = value.toPlain();
        } else if (Array.isArray(value)) {
          plainObject[key] = value.map((item) =>
            item &&
            typeof item === 'object' &&
            'toPlain' in item &&
            typeof item.toPlain === 'function'
              ? item.toPlain()
              : item,
          );
        } else {
          plainObject[key] = value;
        }
      }
    }

    return plainObject;
  }
}
```

### Domain Entity Structure

```typescript
import { Entity } from '@/core/entities/entity';
import { UniqueEntityID } from '@/core/entities/unique-entity-id';

// 1. Define enum for entity status (if needed)
export enum EntityStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending',
}

// 2. Define Props interface with all entity properties
export interface EntityNameProps {
  // Required fields
  name: string;
  email: string;
  status: EntityStatus;

  // Optional relation fields
  relatedId?: string;
  relatedEntity?: RelatedEntity;

  // Audit fields
  createdByUserId?: string;
  createdBy?: User;
  updatedByUserId?: string;
  updatedBy?: User;
  createdAt?: Date;
  updatedAt?: Date;
}

// 3. Extend base Entity class
export class EntityName extends Entity<EntityNameProps> {
  // Getters for all properties (read-only access)
  get name(): string {
    return this.props.name;
  }

  get email(): string {
    return this.props.email;
  }

  get status(): EntityStatus {
    return this.props.status;
  }

  get relatedId(): string | undefined {
    return this.props.relatedId;
  }

  get relatedEntity(): RelatedEntity | undefined {
    return this.props.relatedEntity;
  }

  get createdByUserId(): string | undefined {
    return this.props.createdByUserId;
  }

  get createdBy(): User | undefined {
    return this.props.createdBy;
  }

  get createdAt(): Date | undefined {
    return this.props.createdAt;
  }

  get updatedAt(): Date | undefined {
    return this.props.updatedAt;
  }

  // Domain methods (business logic that modifies state)
  activate(): void {
    this.props.status = EntityStatus.ACTIVE;
    this.props.updatedAt = new Date();
  }

  deactivate(): void {
    this.props.status = EntityStatus.INACTIVE;
    this.props.updatedAt = new Date();
  }

  updateName(name: string): void {
    this.props.name = name;
    this.props.updatedAt = new Date();
  }

  // Static factory method
  public static create(props: EntityNameProps, id?: string): EntityName {
    return new EntityName(
      {
        ...props,
        status: props.status ?? EntityStatus.PENDING,
        createdAt: props.createdAt ?? new Date(),
        updatedAt: props.updatedAt ?? new Date(),
      },
      id ? new UniqueEntityID(id) : undefined,
    );
  }
}
```

### Key Entity Patterns

1. **Enum for status**: Define enum for entity state management
2. **Props interface**: Define all properties with clear grouping (required, optional, relations, audit)
3. **Getters**: Expose props through getters (read-only access)
4. **Domain methods**: Business logic that modifies entity state (always update `updatedAt`)
5. **Static create()**: Factory method with default values using nullish coalescing (`??`)
6. **UniqueEntityID**: Create with id string if provided, otherwise undefined for auto-generation

---

## 8. Value Object Pattern

Value Objects are immutable and compared by value. Located in `src/core/value-objects/`.

### Base ValueObject Class

```typescript
export abstract class ValueObject<T> {
  protected readonly props: T;

  protected constructor(props: T) {
    this.props = Object.freeze(props);
  }

  public equals(vo?: ValueObject<T>): boolean {
    if (vo === null || vo === undefined) {
      return false;
    }
    return JSON.stringify(this.props) === JSON.stringify(vo.props);
  }

  public get value(): T {
    return this.props;
  }

  public toPlain(): T | Record<string, unknown> {
    if (typeof this.props === 'object' && this.props !== null) {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(this.props as object)) {
        if (value instanceof ValueObject) {
          result[key] = value.toPlain();
        } else {
          result[key] = value;
        }
      }
      return result;
    }
    return this.props;
  }

  public toString(): string {
    if (typeof this.props === 'string') {
      return this.props;
    }
    return JSON.stringify(this.props);
  }
}
```

### Example Value Object

```typescript
import { ValueObject } from '@/core/value-objects/value-object';

interface EmailProps {
  value: string;
}

export class Email extends ValueObject<EmailProps> {
  private constructor(props: EmailProps) {
    super(props);
  }

  get value(): string {
    return this.props.value;
  }

  public static create(email: string): Email {
    if (!email || !email.includes('@')) {
      throw new Error('Invalid email format');
    }
    return new Email({ value: email.toLowerCase().trim() });
  }

  public toPlain(): string {
    return this.props.value;
  }
}
```

---

## 9. Module Registration

NestJS module setup pattern.

```typescript
import { Module } from '@nestjs/common';
import { EntityController } from './controllers/entity.controller';
import {
  GetAllEntitiesUseCase,
  GetEntityByIdUseCase,
  CreateEntityUseCase,
  UpdateEntityUseCase,
  DeleteEntityUseCase,
} from '@/application/module/use-cases';
import { EntityRepository } from '@/application/module/ports/entity.repository';
import { PrismaEntityRepository } from '@/infra/persistence/prisma/repositories/prisma-entity.repository';
import { PrismaModule } from '@/infra/persistence/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [EntityController],
  providers: [
    // Use Cases
    GetAllEntitiesUseCase,
    GetEntityByIdUseCase,
    CreateEntityUseCase,
    UpdateEntityUseCase,
    DeleteEntityUseCase,
    // Repository binding
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

## File Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| Controller | `{entity}.controller.ts` | `user.controller.ts` |
| Use Case | `{action}-{entity}.use-case.ts` | `create-user.use-case.ts` |
| Repository Port | `{entity}.repository.ts` | `user.repository.ts` |
| Repository Impl | `prisma-{entity}.repository.ts` | `prisma-user.repository.ts` |
| Mapper | `prisma-{entity}.mapper.ts` | `prisma-user.mapper.ts` |
| Request DTO | `{action}-{entity}.request.ts` | `create-user.request.ts` |
| Response DTO | `{entity}.response.ts` | `user.response.ts` |
| Domain Entity | `{entity}.entity.ts` | `user.entity.ts` |
| Value Object | `{name}.value-object.ts` | `email.value-object.ts` |

---

## Quick Checklist

When implementing a new feature:

- [ ] Create domain entity in `src/domain/`
- [ ] Create value objects if needed in `src/core/value-objects/`
- [ ] Create repository port in `src/application/ports/`
- [ ] Create use cases in `src/application/use-cases/`
- [ ] Create Prisma mapper with all 5 methods in `src/infra/persistence/prisma/mapper/`
- [ ] Create Prisma repository in `src/infra/persistence/prisma/repositories/`
- [ ] Create DTOs in `src/infra/http/dtos/`
- [ ] Create controller in `src/infra/http/controllers/`
- [ ] Register in module

---

**Last Updated**: 2025-12-12
