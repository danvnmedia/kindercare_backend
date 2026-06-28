import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { User } from "../../../domain/user-management/user.entity";

/**
 * Decorator to extract the full User entity from the request.
 * Requires middleware/interceptor to attach user object to request.
 *
 * @example
 * ```typescript
 * @Get('profile')
 * @UseGuards(ClerkAuthGuard)
 * @UseInterceptors(UserInterceptor) // Interceptor to fetch and attach user
 * async getProfile(@User() user: User) {
 *   return user;
 * }
 * ```
 */
export const UserDecorator = createParamDecorator(
  (data: keyof User | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    // If specific property is requested, return only that property
    return data ? user?.[data] : user;
  },
);
