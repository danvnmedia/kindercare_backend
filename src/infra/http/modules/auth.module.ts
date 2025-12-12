import { Module } from "@nestjs/common";
import { AuthController } from "../controllers/auth/auth.controller";
import { StandardResponseModule } from "@/core/modules/standard-response";
import { ClerkModule } from "@/infra/external-services/clerk/clerk.module";
import { PrismaModule } from "@/infra/persistence/prisma/prisma.module";
import { UserInterceptor } from "../interceptors/user.interceptor";
import { PrismaUserRepository } from "@/infra/persistence/prisma/repositories/prisma-user.repository";

/**
 * Authentication Module
 *
 * Provides authentication-related endpoints:
 * - GET /auth/me - Get current authenticated user
 *
 * Dependencies:
 * - ClerkModule: Provides AUTHENTICATION_PORT for ClerkAuthGuard
 * - PrismaModule: Provides database access
 * - UserInterceptor: Fetches user from DB after authentication
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
    ClerkModule, // Authentication port for guards
    PrismaModule, // Database access
    StandardResponseModule, // Provides PrismaQueryService
  ],
  controllers: [AuthController],
  providers: [
    UserInterceptor,
    {
      provide: "USER_REPOSITORY",
      useClass: PrismaUserRepository,
    },
  ],
  exports: [
    UserInterceptor,
    {
      provide: "USER_REPOSITORY",
      useClass: PrismaUserRepository,
    },
  ],
})
export class AuthModule {}
