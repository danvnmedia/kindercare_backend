import { Module, forwardRef } from "@nestjs/common";

// Controllers
import { RoleController } from "../controllers/user-management/role.controller";
import { StudentController } from "../controllers/user-management/student.controller";
import { GuardianController } from "../controllers/user-management/guardian.controller";
import { StaffController } from "../controllers/user-management/staff.controller";
import { IdentityAdminController } from "../controllers/user-management/identity-admin.controller";
import { DangerGuardianController } from "../controllers/danger/danger-guardian.controller";
import { DangerStaffController } from "../controllers/danger/danger-staff.controller";
import { DangerStudentController } from "../controllers/danger/danger-student.controller";

// NOTE: Legacy User CRUD use cases are commented out until they are refactored to work with Person-based model.
// Global identity administration use cases below are explicit identity lifecycle operations.
// import { CreateUserUseCase } from '@/application/user-management/use-cases/user/create-user.use-case';
// import { GetUserByIdUseCase } from '@/application/user-management/use-cases/user/get-user-by-id.use-case';
// import { GetAllUsersUseCase } from '@/application/user-management/use-cases/user/get-all-users.use-case';
// import { UpdateUserUseCase } from '@/application/user-management/use-cases/user/update-user.use-case';
// import { DeleteUserUseCase } from '@/application/user-management/use-cases/user/delete-user.use-case';
// import { AssignRolesToUserUseCase } from '@/application/user-management/use-cases/user/assign-roles-to-user.use-case';
// import { RemoveRolesFromUserUseCase } from '@/application/user-management/use-cases/user/remove-roles-from-user.use-case';

// Use Cases - Global Identity Admin
import { DeleteGlobalIdentityUseCase } from "@/application/user-management/use-cases/user/delete-global-identity.use-case";
import { LockGlobalIdentityUseCase } from "@/application/user-management/use-cases/user/lock-global-identity.use-case";
import { UnlockGlobalIdentityUseCase } from "@/application/user-management/use-cases/user/unlock-global-identity.use-case";

// Use Cases - Role
import { CreateRoleUseCase } from "@/application/user-management/use-cases/role/create-role.use-case";
import { GetRoleByIdUseCase } from "@/application/user-management/use-cases/role/get-role-by-id.use-case";
import { GetAllRolesUseCase } from "@/application/user-management/use-cases/role/get-all-roles.use-case";
import { UpdateRoleUseCase } from "@/application/user-management/use-cases/role/update-role.use-case";
import { DeleteRoleUseCase } from "@/application/user-management/use-cases/role/delete-role.use-case";
import { AssignUsersToRoleUseCase } from "@/application/user-management/use-cases/role/assign-users-to-role.use-case";
import { RemoveUsersFromRoleUseCase } from "@/application/user-management/use-cases/role/remove-users-from-role.use-case";
import { GetRoleMembersUseCase } from "@/application/user-management/use-cases/role/get-role-members.use-case";

// Use Cases - Student
import { CreateStudentUseCase } from "@/application/user-management/use-cases/student/create-student.use-case";
import { GetAllStudentsUseCase } from "@/application/user-management/use-cases/student/get-all-students.use-case";
import { GetStudentByIdUseCase } from "@/application/user-management/use-cases/student/get-student-by-id.use-case";
import { UpdateStudentUseCase } from "@/application/user-management/use-cases/student/update-student.use-case";
import { DeleteStudentUseCase } from "@/application/user-management/use-cases/student/delete-student.use-case";
import { ArchiveStudentUseCase } from "@/application/user-management/use-cases/student/archive-student.use-case";
import { RestoreStudentUseCase } from "@/application/user-management/use-cases/student/restore-student.use-case";
import { LinkStudentWithGuardianUseCase } from "@/application/user-management/use-cases/student/link-student-with-guardian.use-case";
import { UnlinkStudentFromGuardianUseCase } from "@/application/user-management/use-cases/student/unlink-student-from-guardian.use-case";
import { GetStudentGuardiansUseCase } from "@/application/user-management/use-cases/student/get-student-guardians.use-case";
import { UpdateStudentGuardianRelationshipUseCase } from "@/application/user-management/use-cases/student/update-student-guardian-relationship.use-case";

// Use Cases - Guardian
import { CreateGuardianUseCase } from "@/application/user-management/use-cases/guardian/create-guardian.use-case";
import { CreateOrAttachGuardianUseCase } from "@/application/user-management/use-cases/guardian/create-or-attach-guardian.use-case";
import { GetAllGuardiansUseCase } from "@/application/user-management/use-cases/guardian/get-all-guardians.use-case";
import { GetGuardianByIdUseCase } from "@/application/user-management/use-cases/guardian/get-guardian-by-id.use-case";
import { UpdateGuardianUseCase } from "@/application/user-management/use-cases/guardian/update-guardian.use-case";
import { DeleteGuardianUseCase } from "@/application/user-management/use-cases/guardian/delete-guardian.use-case";
import { ArchiveGuardianUseCase } from "@/application/user-management/use-cases/guardian/archive-guardian.use-case";
import { RestoreGuardianUseCase } from "@/application/user-management/use-cases/guardian/restore-guardian.use-case";
import { LinkStudentToGuardianUseCase } from "@/application/user-management/use-cases/guardian/link-student-to-guardian.use-case";
import { UnlinkStudentFromGuardianUseCase as UnlinkStudentFromGuardianUseCaseGuardianSide } from "@/application/user-management/use-cases/guardian/unlink-student-from-guardian.use-case";
import { GetGuardianChildrenUseCase } from "@/application/user-management/use-cases/guardian/get-guardian-children.use-case";
import { GetCurrentGuardianCampusesUseCase } from "@/application/user-management/use-cases/guardian/get-current-guardian-campuses.use-case";
import { GetCurrentGuardianStudentsUseCase } from "@/application/absence-request";

// Use Cases - Staff
import { CreateStaffUseCase } from "@/application/user-management/use-cases/staff/create-staff.use-case";
import { CreateOrAttachStaffUseCase } from "@/application/user-management/use-cases/staff/create-or-attach-staff.use-case";
import { GetStaffByIdUseCase } from "@/application/user-management/use-cases/staff/get-staff-by-id.use-case";
import { GetAllStaffUseCase } from "@/application/user-management/use-cases/staff/get-all-staff.use-case";
import { UpdateStaffUseCase } from "@/application/user-management/use-cases/staff/update-staff.use-case";
import { ArchiveStaffUseCase } from "@/application/user-management/use-cases/staff/archive-staff.use-case";
import { RestoreStaffUseCase } from "@/application/user-management/use-cases/staff/restore-staff.use-case";
import { DeleteStaffUseCase } from "@/application/user-management/use-cases/staff/delete-staff.use-case";

// Repositories
import { PrismaUserRepository } from "@/infra/persistence/prisma/repositories/prisma-user.repository";
import { PrismaRoleRepository } from "@/infra/persistence/prisma/repositories/prisma-role.repository";
import { PrismaStudentRepository } from "@/infra/persistence/prisma/repositories/prisma-student.repository";
import { PrismaGuardianRepository } from "@/infra/persistence/prisma/repositories/prisma-guardian.repository";
import { PrismaStaffRepository } from "@/infra/persistence/prisma/repositories/prisma-staff.repository";

// Ports
import { StudentCodeGeneratorPort } from "@/application/ports/student-code-generator.port";
import { StaffCodeGeneratorPort } from "@/application/ports/staff-code-generator.port";

// Services (Infrastructure implementations)
import { StudentCodeGeneratorService } from "@/infra/persistence/prisma/services/student-code-generator.service";
import { StaffCodeGeneratorService } from "@/infra/persistence/prisma/services/staff-code-generator.service";

// Modules
import { PrismaModule } from "@/infra/persistence/prisma/prisma.module";
import { ClerkModule } from "@/infra/external-services/clerk/clerk.module";
import { StandardResponseModule } from "@/core/modules/standard-response/standard-response.module";
import { RbacModule } from "./rbac.module";
import { CampusModule } from "./campus.module";
import { StaffTypeModule } from "./staff-type.module";
import { GuardianRelationshipTypeModule } from "./guardian-relationship-type.module";
import { RequestContextModule } from "../context/request-context.module";

// Guards
import { CampusGuard } from "../guards/campus.guard";
import { HydrateCurrentUserGuard } from "../guards/hydrate-current-user.guard";
import { RolesGuard } from "../guards/roles.guard";
import { PermissionsGuard } from "../guards/permissions.guard";
import { GlobalAdminGuard } from "../guards/global-admin.guard";

/**
 * User Management Module
 *
 * HTTP presentation module for user and role management.
 * Follows Clean Architecture with clear layer separation.
 *
 * Imports:
 * - PrismaModule: Provides database repositories (USER_REPOSITORY, ROLE_REPOSITORY)
 * - ClerkModule: Provides authentication (AUTHENTICATION_PORT) and identity services
 * - StandardResponseModule: Provides PrismaQueryService for advanced filtering and pagination
 * - RequestContextModule: Provides request-scoped authentication context for guards
 *
 * Layer structure:
 * Controllers → Use Cases → Repositories (Ports) → Adapters (Implementations)
 */
@Module({
  imports: [
    PrismaModule, // Database access
    ClerkModule, // Authentication & Identity management
    StandardResponseModule, // Query service for filtering and pagination
    RbacModule, // Permission management
    CampusModule, // Campus repository for role campus validation
    RequestContextModule, // Request-scoped authentication context
    forwardRef(() => StaffTypeModule), // For STAFF_TYPE_REPOSITORY (circular dep with StaffTypeModule)
    forwardRef(() => GuardianRelationshipTypeModule), // For GUARDIAN_RELATIONSHIP_TYPE_REPOSITORY (used by LinkStudentWithGuardianUseCase)
  ],
  controllers: [
    RoleController,
    IdentityAdminController,
    StudentController,
    GuardianController,
    StaffController,
    DangerGuardianController,
    DangerStaffController,
    DangerStudentController,
  ],
  providers: [
    // NOTE: Legacy User Use Cases commented out until refactored
    // CreateUserUseCase,
    // GetUserByIdUseCase,
    // GetAllUsersUseCase,
    // UpdateUserUseCase,
    // DeleteUserUseCase,
    // AssignRolesToUserUseCase,
    // RemoveRolesFromUserUseCase,

    // Global Identity Admin Use Cases
    LockGlobalIdentityUseCase,
    UnlockGlobalIdentityUseCase,
    DeleteGlobalIdentityUseCase,

    // Role Use Cases
    CreateRoleUseCase,
    GetRoleByIdUseCase,
    GetAllRolesUseCase,
    UpdateRoleUseCase,
    DeleteRoleUseCase,
    AssignUsersToRoleUseCase,
    RemoveUsersFromRoleUseCase,
    GetRoleMembersUseCase,

    // Student Use Cases
    CreateStudentUseCase,
    GetAllStudentsUseCase,
    GetStudentByIdUseCase,
    UpdateStudentUseCase,
    DeleteStudentUseCase,
    ArchiveStudentUseCase,
    RestoreStudentUseCase,
    LinkStudentWithGuardianUseCase,
    UnlinkStudentFromGuardianUseCase,
    GetStudentGuardiansUseCase,
    UpdateStudentGuardianRelationshipUseCase,

    // Port bindings (Port → Implementation)
    {
      provide: StudentCodeGeneratorPort,
      useClass: StudentCodeGeneratorService,
    },
    {
      provide: StaffCodeGeneratorPort,
      useClass: StaffCodeGeneratorService,
    },

    // Guardian Use Cases
    CreateGuardianUseCase,
    CreateOrAttachGuardianUseCase,
    GetAllGuardiansUseCase,
    GetGuardianByIdUseCase,
    UpdateGuardianUseCase,
    DeleteGuardianUseCase,
    ArchiveGuardianUseCase,
    RestoreGuardianUseCase,
    LinkStudentToGuardianUseCase,
    UnlinkStudentFromGuardianUseCaseGuardianSide,
    GetGuardianChildrenUseCase,
    GetCurrentGuardianCampusesUseCase,
    GetCurrentGuardianStudentsUseCase,

    // Staff Use Cases
    CreateStaffUseCase,
    CreateOrAttachStaffUseCase,
    GetStaffByIdUseCase,
    GetAllStaffUseCase,
    UpdateStaffUseCase,
    ArchiveStaffUseCase,
    RestoreStaffUseCase,
    DeleteStaffUseCase,

    // Repositories with Dependency Injection Tokens
    {
      provide: "USER_REPOSITORY",
      useClass: PrismaUserRepository,
    },
    {
      provide: "ROLE_REPOSITORY",
      useClass: PrismaRoleRepository,
    },
    {
      provide: "STUDENT_REPOSITORY",
      useClass: PrismaStudentRepository,
    },
    {
      provide: "GUARDIAN_REPOSITORY",
      useClass: PrismaGuardianRepository,
    },
    {
      provide: "STAFF_REPOSITORY",
      useClass: PrismaStaffRepository,
    },

    // Guards (use RequestContext for user access)
    CampusGuard,
    HydrateCurrentUserGuard,
    RolesGuard,
    PermissionsGuard,
    GlobalAdminGuard,
  ],
  exports: [
    "USER_REPOSITORY",
    "ROLE_REPOSITORY",
    "STUDENT_REPOSITORY",
    "GUARDIAN_REPOSITORY",
    "STAFF_REPOSITORY",
  ],
})
export class UserManagementModule {}
