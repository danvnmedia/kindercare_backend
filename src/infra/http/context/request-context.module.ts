import { Module } from "@nestjs/common";
import { RequestContext } from "./request-context.service";
import { PrismaUserRepository } from "@/infra/persistence/prisma/repositories/prisma-user.repository";
import { PrismaModule } from "@/infra/persistence/prisma/prisma.module";
import { StandardResponseModule } from "@/core/modules/standard-response";

/**
 * Request Context Module
 *
 * Provides the RequestContext service for request-scoped authentication context.
 * This module should be imported by any module that needs access to the current
 * user or authentication context.
 *
 * The RequestContext service is request-scoped, meaning:
 * - A new instance is created for each HTTP request
 * - User data is lazy-loaded and cached per request
 * - The instance is automatically garbage collected after the request completes
 *
 * @example
 * ```typescript
 * @Module({
 *   imports: [RequestContextModule],
 *   providers: [SomeGuard, SomeService],
 * })
 * export class SomeModule {}
 * ```
 */
@Module({
  imports: [
    PrismaModule, // PrismaService for repository
    StandardResponseModule, // PrismaQueryService for repository
  ],
  providers: [
    RequestContext,
    {
      provide: "USER_REPOSITORY",
      useClass: PrismaUserRepository,
    },
  ],
  exports: [RequestContext, "USER_REPOSITORY"],
})
export class RequestContextModule {}
