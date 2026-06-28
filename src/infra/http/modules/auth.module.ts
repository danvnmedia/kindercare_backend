import { Module } from "@nestjs/common";
import { AuthController } from "../controllers/auth/auth.controller";
import { StandardResponseModule } from "@/core/modules/standard-response";
import { ClerkModule } from "@/infra/external-services/clerk/clerk.module";
import { PrismaModule } from "@/infra/persistence/prisma/prisma.module";
import { RequestContextModule } from "../context/request-context.module";
import { ClerkAuthGuard } from "../guards/clerk-auth.guard";

/**
 * Authentication Module
 *
 * Provides authentication-related endpoints:
 * - GET /auth/me - Get current authenticated user
 *
 * Dependencies:
 * - ClerkModule: Provides AUTHENTICATION_PORT for AuthMiddleware
 * - PrismaModule: Provides database access
 * - RequestContextModule: Provides RequestContext for lazy-loaded user access
 *
 * Authentication Flow:
 * 1. AuthMiddleware (in HttpModule) verifies Clerk token
 * 2. ClerkAuthGuard checks clerkId exists
 * 3. RequestContext lazily loads user when accessed via @CurrentUser()
 *
 * @example
 * // Import in AppModule:
 * @Module({
 *   imports: [AuthModule],
 * })
 * export class AppModule {}
 */
@Module({
  imports: [
    ClerkModule, // Authentication port for middleware
    PrismaModule, // Database access
    StandardResponseModule, // Provides PrismaQueryService
    RequestContextModule, // Request-scoped authentication context
  ],
  controllers: [AuthController],
  providers: [ClerkAuthGuard],
  exports: [ClerkAuthGuard, RequestContextModule],
})
export class AuthModule {}
