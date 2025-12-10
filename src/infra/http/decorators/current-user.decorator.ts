import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserPayload } from '@/types/globals';

/**
 * Decorator to extract the current authenticated user's Clerk ID from the request.
 * Must be used with ClerkAuthGuard.
 *
 * @example
 * ```typescript
 * @Get('profile')
 * @UseGuards(ClerkAuthGuard)
 * async getProfile(@CurrentUser() clerkId: string) {
 *   return this.getUserByClerkId(clerkId);
 * }
 * ```
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): UserPayload => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
