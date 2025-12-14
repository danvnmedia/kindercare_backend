# Guards Pattern

> Authentication & Authorization. Located in `src/infra/http/guards/`

---

## JWT Guard

```typescript
@Injectable()
export class JwtGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const token = request.headers.authorization?.split(' ')[1];

    if (!token) throw new UnauthorizedException('Missing token');

    try {
      request.user = await this.jwtService.verifyAsync(token);
      return true;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
```

---

## Email Verified Guard

```typescript
@Injectable()
export class EmailVerifiedGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_EMAIL_VERIFICATION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const user = context.switchToHttp().getRequest().user;
    if (!user?.emailVerified) throw new ForbiddenException('Email verification required');
    return true;
  }
}
```

---

## Role Guard

```typescript
@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles?.length) return true;

    const user = context.switchToHttp().getRequest().user;
    if (!roles.includes(user?.role)) throw new ForbiddenException('Insufficient permissions');
    return true;
  }
}
```

---

## Composition

```typescript
@Controller('admin')
@UseGuards(JwtGuard, EmailVerifiedGuard, RoleGuard)
@Roles(UserRole.ADMIN)
export class AdminController {}
```

Order: JWT → EmailVerified → Role
