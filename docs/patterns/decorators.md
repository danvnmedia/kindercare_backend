# Decorators Pattern

> Custom HTTP decorators. Located in `src/infra/http/decorators/`

---

## Public

```typescript
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

---

## Skip Email Verification

```typescript
export const SKIP_EMAIL_VERIFICATION_KEY = 'skipEmailVerification';
export const SkipEmailVerification = () => SetMetadata(SKIP_EMAIL_VERIFICATION_KEY, true);
```

---

## Roles

```typescript
export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
```

---

## User

```typescript
export const User = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const user = ctx.switchToHttp().getRequest().user;
    return data ? user?.[data] : user;
  },
);
```

---

## Usage

```typescript
@Controller('orders')
@UseGuards(JwtGuard, EmailVerifiedGuard, RoleGuard)
export class OrderController {
  @Get('public')
  @Public()
  async getPublic() {}

  @Post('guest')
  @SkipEmailVerification()
  @Roles(UserRole.GUEST)
  async createGuest(@User() user: AuthenticatedUser) {}

  @Post()
  @Roles(UserRole.USER)
  async create(@User('id') userId: string) {}

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  async delete(@Param('id') id: string) {}
}
```
