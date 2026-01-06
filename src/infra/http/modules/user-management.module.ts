import { Module } from "@nestjs/common";

// Controllers
import { RoleController } from "../controllers/user-management/role.controller";
import { StudentController } from "../controllers/user-management/student.controller";
import { GuardianController } from "../controllers/user-management/guardian.controller";
import { StaffController } from "../controllers/user-management/staff.controller";
import { DangerGuardianController } from "../controllers/danger/danger-guardian.controller";
import { DangerStaffController } from "../controllers/danger/danger-staff.controller";

// NOTE: User use cases are commented out until they are refactored to work with Person-based model
// import { CreateUserUseCase } from '@/application/user-management/use-cases/user/create-user.use-case';
// import { GetUserByIdUseCase } from '@/application/user-management/use-cases/user/get-user-by-id.use-case';
// import { GetAllUsersUseCase } from '@/application/user-management/use-cases/user/get-all-users.use-case';
// import { UpdateUserUseCase } from '@/application/user-management/use-cases/user/update-user.use-case';
// import { DeleteUserUseCase } from '@/application/user-management/use-cases/user/delete-user.use-case';
// import { AssignRolesToUserUseCase } from '@/application/user-management/use-cases/user/assign-roles-to-user.use-case';
// import { RemoveRolesFromUserUseCase } from '@/application/user-management/use-cases/user/remove-roles-from-user.use-case';

// Use Cases - Role
import { CreateRoleUseCase } from "@/application/user-management/use-cases/role/create-role.use-case";
import { GetRoleByIdUseCase } from "@/application/user-management/use-cases/role/get-role-by-id.use-case";
import { GetAllRolesUseCase } from "@/application/user-management/use-cases/role/get-all-roles.use-case";
import { UpdateRoleUseCase } from "@/application/user-management/use-cases/role/update-role.use-case";
import { DeleteRoleUseCase } from "@/application/user-management/use-cases/role/delete-role.use-case";
import { AssignUsersToRoleUseCase } from "@/application/user-management/use-cases/role/assign-users-to-role.use-case";
import { RemoveUsersFromRoleUseCase } from "@/application/user-management/use-cases/role/remove-users-from-role.use-case";

// Use Cases - Student
import { CreateStudentUseCase } from "@/application/user-management/use-cases/student/create-student.use-case";
import { GetAllStudentsUseCase } from "@/application/user-management/use-cases/student/get-all-students.use-case";
import { UpdateStudentUseCase } from "@/application/user-management/use-cases/student/update-student.use-case";
import { DeleteStudentUseCase } from "@/application/user-management/use-cases/student/delete-student.use-case";
import { LinkStudentWithGuardianUseCase } from "@/application/user-management/use-cases/student/link-student-with-guardian.use-case";
import { UnlinkStudentFromGuardianUseCase } from "@/application/user-management/use-cases/student/unlink-student-from-guardian.use-case";
import { GetStudentGuardiansUseCase } from "@/application/user-management/use-cases/student/get-student-guardians.use-case";

// Use Cases - Guardian
import { CreateGuardianUseCase } from "@/application/user-management/use-cases/guardian/create-guardian.use-case";
import { GetAllGuardiansUseCase } from "@/application/user-management/use-cases/guardian/get-all-guardians.use-case";
import { GetGuardianByIdUseCase } from "@/application/user-management/use-cases/guardian/get-guardian-by-id.use-case";
import { UpdateGuardianUseCase } from "@/application/user-management/use-cases/guardian/update-guardian.use-case";
import { DeleteGuardianUseCase } from "@/application/user-management/use-cases/guardian/delete-guardian.use-case";
import { ArchiveGuardianUseCase } from "@/application/user-management/use-cases/guardian/archive-guardian.use-case";
import { RestoreGuardianUseCase } from "@/application/user-management/use-cases/guardian/restore-guardian.use-case";

// Use Cases - Staff
import { CreateStaffUseCase } from "@/application/user-management/use-cases/staff/create-staff.use-case";
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

// Services (Infrastructure implementations)
import { StudentCodeGeneratorService } from "@/infra/persistence/prisma/services/student-code-generator.service";

// Modules
import { PrismaModule } from "@/infra/persistence/prisma/prisma.module";
import { ClerkModule } from "@/infra/external-services/clerk/clerk.module";
import { StandardResponseModule } from "@/core/modules/standard-response/standard-response.module";

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
 *
 * Layer structure:
 * Controllers → Use Cases → Repositories (Ports) → Adapters (Implementations)
 */
@Module({
  imports: [
    PrismaModule, // Database access
    ClerkModule, // Authentication & Identity management
    StandardResponseModule, // Query service for filtering and pagination
  ],
  controllers: [
    RoleController,
    StudentController,
    GuardianController,
    StaffController,
    DangerGuardianController,
    DangerStaffController,
  ],
  providers: [
    // NOTE: User Use Cases commented out until refactored
    // CreateUserUseCase,
    // GetUserByIdUseCase,
    // GetAllUsersUseCase,
    // UpdateUserUseCase,
    // DeleteUserUseCase,
    // AssignRolesToUserUseCase,
    // RemoveRolesFromUserUseCase,

    // Role Use Cases
    CreateRoleUseCase,
    GetRoleByIdUseCase,
    GetAllRolesUseCase,
    UpdateRoleUseCase,
    DeleteRoleUseCase,
    AssignUsersToRoleUseCase,
    RemoveUsersFromRoleUseCase,

    // Student Use Cases
    CreateStudentUseCase,
    GetAllStudentsUseCase,
    UpdateStudentUseCase,
    DeleteStudentUseCase,
    LinkStudentWithGuardianUseCase,
    UnlinkStudentFromGuardianUseCase,
    GetStudentGuardiansUseCase,

    // Port bindings (Port → Implementation)
    {
      provide: StudentCodeGeneratorPort,
      useClass: StudentCodeGeneratorService,
    },

    // Guardian Use Cases
    CreateGuardianUseCase,
    GetAllGuardiansUseCase,
    GetGuardianByIdUseCase,
    UpdateGuardianUseCase,
    DeleteGuardianUseCase,
    ArchiveGuardianUseCase,
    RestoreGuardianUseCase,

    // Staff Use Cases
    CreateStaffUseCase,
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
