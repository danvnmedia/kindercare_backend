import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { User } from "@/domain/user-management/user.entity";

/**
 * Decorator to extract the full `User` domain entity for the authenticated request.
 *
 * Returns the `User` populated on `request.user` by `RequestContext.getUser()`, which
 * is called transitively by `CampusGuard`, `RolesGuard`, and `PermissionsGuard`.
 *
 * Preconditions:
 * - `ClerkAuthGuard` must run first (sets `clerkId` on `RequestContext`).
 * - At least one downstream guard that calls `requestContext.getUser()` must run,
 *   typically via `@RequireCampusAccess`, `@Roles`, or `@Permissions`.
 * - For controller methods without such a guard, call
 *   `await this.requestContext.getUserOrFail()` directly instead of relying on this
 *   decorator.
 *
 * Used by audit-log plumbing (`@task-qyz3jv`, `@doc/specs/admin-audit-log`): the
 * controller is the boundary that injects the actor; mutation use cases accept
 * `currentUser: User` as the last positional argument on `execute()`.
 *
 * @example
 * ```typescript
 * @Post()
 * @RequireCampusAccess()
 * async create(@CurrentUser() user: User, @Body() dto: CreateXDto) {
 *   return this.createXUseCase.execute(dto, user);
 * }
 * ```
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): User => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
