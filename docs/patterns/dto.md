# DTO Pattern

> Request/Response validation. Located in `src/infra/http/dtos/`

---

## Request DTO

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional, IsEnum, IsUUID, MinLength } from 'class-validator';

export class CreateEntityRequest {
  @ApiProperty({ example: 'Entity Name' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ example: 'entity@example.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ enum: EntityStatus })
  @IsOptional()
  @IsEnum(EntityStatus)
  status?: EntityStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  relatedId?: string;
}
```

---

## Response DTO

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
}
```

---

## Important

- Request DTOs: Use `class-validator` decorators
- Response DTOs: Use `@Expose()` (required for `excludeExtraneousValues: true`)
- Nested DTOs: Use `@Type(() => NestedDTO)`
