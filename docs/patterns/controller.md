# Controller Pattern

> HTTP request handling. Located in `src/infra/http/controllers/`

---

## Structure

```typescript
import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtGuard, EmailVerifiedGuard, RoleGuard } from '../guards';
import { Roles } from '../decorators/roles.decorator';
import { User } from '../decorators/user.decorator';
import { StandardResponse } from '@/core/modules/standard-response';
import { StandardRequestParam } from '@/core/modules/standard-response/decorators';
import { UserRole } from '@/domain/user-management/user';

@ApiTags('Entities')
@ApiBearerAuth('JWT')
@Controller('entities')
@UseGuards(JwtGuard, EmailVerifiedGuard, RoleGuard)
export class EntityController {
  constructor(
    private readonly getEntityUseCase: GetEntityUseCase,
    private readonly createEntityUseCase: CreateEntityUseCase,
  ) {}

  @Get()
  @Roles(UserRole.ADMIN)
  @StandardResponse({
    type: EntityResponse,
    message: 'Entities retrieved',
    isPaginated: true,
    allowedSortFields: ['name', 'createdAt'],
    allowedFilterFields: ['name', 'status'],
  })
  async findAll(@StandardRequestParam() params: StandardRequest) {
    return this.getEntityUseCase.execute(params);
  }

  @Get(':id')
  @Roles(UserRole.USER, UserRole.ADMIN)
  @StandardResponse({ type: EntityResponse, message: 'Entity retrieved' })
  async findOne(@Param('id') id: string) {
    return this.getEntityUseCase.execute({ id });
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @StandardResponse({ type: EntityResponse, message: 'Entity created' })
  async create(@User() user: AuthenticatedUser, @Body() dto: CreateEntityRequest) {
    return this.createEntityUseCase.execute({ ...dto, createdByUserId: user.id });
  }
}
```

---

## Key Patterns

1. **Guards**: `@UseGuards(JwtGuard, EmailVerifiedGuard, RoleGuard)`
2. **Roles**: `@Roles(UserRole.X)` for authorization
3. **StandardResponse**: Consistent API responses
4. **StandardRequestParam**: Pagination, sorting, filtering
5. **User decorator**: Get authenticated user
