import { SetMetadata } from "@nestjs/common";

/**
 * Public Decorator
 *
 * Marks a route or controller as public, bypassing authentication guards.
 * Use this decorator for routes that should be accessible without authentication.
 *
 * @example
 * // Public endpoint (no authentication required)
 * @Public()
 * @Get('health')
 * async health() {
 *   return { status: 'ok' };
 * }
 *
 * @example
 * // Apply to entire controller
 * @Public()
 * @Controller('public')
 * class PublicController {
 *   // All routes in this controller are public
 * }
 */
export const IS_PUBLIC_KEY = "isPublic";
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
