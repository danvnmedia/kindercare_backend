import { Module } from "@nestjs/common";

// Use Cases
import {
  GetAllPermissionsUseCase,
  GetPermissionsByModuleUseCase,
  SeedPermissionsUseCase,
  AssignPermissionsToRoleUseCase,
  RemovePermissionsFromRoleUseCase,
  ReplaceRolePermissionsUseCase,
} from "@/application/rbac";

// Repositories
import { PrismaPermissionRepository } from "@/infra/persistence/prisma/repositories/prisma-permission.repository";
import { PrismaRoleRepository } from "@/infra/persistence/prisma/repositories/prisma-role.repository";

// Modules
import { PrismaModule } from "@/infra/persistence/prisma/prisma.module";
import { StandardResponseModule } from "@/core/modules/standard-response/standard-response.module";

/**
 * RBAC (Role-Based Access Control) Module
 *
 * Provides permission management and RBAC functionality.
 * This module is imported by UserManagementModule to extend Role functionality.
 *
 * Exports:
 * - PERMISSION_REPOSITORY: For permission data access
 * - Permission use cases: For managing permissions
 */
@Module({
  imports: [PrismaModule, StandardResponseModule],
  providers: [
    // Use Cases
    GetAllPermissionsUseCase,
    GetPermissionsByModuleUseCase,
    SeedPermissionsUseCase,
    AssignPermissionsToRoleUseCase,
    RemovePermissionsFromRoleUseCase,
    ReplaceRolePermissionsUseCase,

    // Repositories
    {
      provide: "PERMISSION_REPOSITORY",
      useClass: PrismaPermissionRepository,
    },
    {
      provide: "ROLE_REPOSITORY",
      useClass: PrismaRoleRepository,
    },
  ],
  exports: [
    "PERMISSION_REPOSITORY",
    GetAllPermissionsUseCase,
    GetPermissionsByModuleUseCase,
    SeedPermissionsUseCase,
    AssignPermissionsToRoleUseCase,
    RemovePermissionsFromRoleUseCase,
    ReplaceRolePermissionsUseCase,
  ],
})
export class RbacModule {}
