import { Module } from "@nestjs/common";
import { IdentityService } from "./identity.service";
import { ClerkClientProvider } from "./clerk-client.provider";
import { ClerkAuthenticationAdapter } from "./clerk-authentication.adapter";
import { IdentityPort } from "@/application/ports/identity.port";

/**
 * Clerk Module
 *
 * Infrastructure module that provides Clerk-based implementations for:
 * - Identity management (user provisioning, updates, deletion)
 * - Authentication verification
 *
 * This module follows Clean Architecture by:
 * - Exporting port interfaces (AUTHENTICATION_PORT, IdentityPort), not concrete implementations
 * - Allowing application layer to depend on abstractions
 * - Enabling easy replacement of authentication provider
 *
 * @example
 * // In other modules:
 * @Module({
 *   imports: [ClerkModule],
 *   controllers: [UserController],
 * })
 * class UserManagementModule {}
 */
@Module({
  providers: [
    // Clerk client configuration
    ClerkClientProvider,

    // Identity port binding (Port → Implementation)
    {
      provide: IdentityPort,
      useClass: IdentityService,
    },

    // Authentication adapter implementing port
    {
      provide: "AUTHENTICATION_PORT",
      useClass: ClerkAuthenticationAdapter,
    },
  ],
  exports: [
    // Export identity port for user provisioning
    IdentityPort,

    // Export authentication port for guards
    "AUTHENTICATION_PORT",
  ],
})
export class ClerkModule {}
