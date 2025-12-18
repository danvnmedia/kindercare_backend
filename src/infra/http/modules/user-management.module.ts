import { Module } from "@nestjs/common";

// Controllers
import { RoleController } from "../controllers/user-management/role.controller";
import { StudentController } from "../controllers/user-management/student.controller";
import { GuardianController } from "../controllers/user-management/guardian.controller";
import { TeacherController } from "../controllers/user-management/teacher.controller";

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

// Use Cases - Teacher
import { CreateTeacherUseCase } from "@/application/user-management/use-cases/teacher/create-teacher.use-case";
import { GetTeacherByIdUseCase } from "@/application/user-management/use-cases/teacher/get-teacher-by-id.use-case";
import { GetAllTeachersUseCase } from "@/application/user-management/use-cases/teacher/get-all-teachers.use-case";
import { UpdateTeacherUseCase } from "@/application/user-management/use-cases/teacher/update-teacher.use-case";
import { ArchiveTeacherUseCase } from "@/application/user-management/use-cases/teacher/archive-teacher.use-case";
import { RestoreTeacherUseCase } from "@/application/user-management/use-cases/teacher/restore-teacher.use-case";

// Repositories
import { PrismaUserRepository } from "@/infra/persistence/prisma/repositories/prisma-user.repository";
import { PrismaRoleRepository } from "@/infra/persistence/prisma/repositories/prisma-role.repository";
import { PrismaStudentRepository } from "@/infra/persistence/prisma/repositories/prisma-student.repository";
import { PrismaGuardianRepository } from "@/infra/persistence/prisma/repositories/prisma-guardian.repository";
import { PrismaTeacherRepository } from "@/infra/persistence/prisma/repositories/prisma-teacher.repository";

// Services
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
    TeacherController,
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

    // Services
    StudentCodeGeneratorService,

    // Guardian Use Cases
    CreateGuardianUseCase,
    GetAllGuardiansUseCase,

    // Teacher Use Cases
    CreateTeacherUseCase,
    GetTeacherByIdUseCase,
    GetAllTeachersUseCase,
    UpdateTeacherUseCase,
    ArchiveTeacherUseCase,
    RestoreTeacherUseCase,

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
      provide: "TEACHER_REPOSITORY",
      useClass: PrismaTeacherRepository,
    },
  ],
  exports: [
    "USER_REPOSITORY",
    "ROLE_REPOSITORY",
    "STUDENT_REPOSITORY",
    "GUARDIAN_REPOSITORY",
    "TEACHER_REPOSITORY",
  ],
})
export class UserManagementModule {}
