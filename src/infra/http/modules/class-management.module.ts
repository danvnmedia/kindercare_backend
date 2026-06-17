import { Module } from "@nestjs/common";

// Controllers
import { ClassController } from "../controllers/class-management/class.controller";
import { ReferenceDataController } from "../controllers/class-management/reference-data.controller";
import { StudentEnrollmentController } from "../controllers/class-management/student-enrollment.controller";
import { SchoolYearEnrollmentController } from "../controllers/class-management/school-year-enrollment.controller";
import { SchoolYearEnrollmentLifecycleController } from "../controllers/class-management/school-year-enrollment-lifecycle.controller";

// Use Cases - Class
import { CreateClassUseCase } from "@/application/class-management/use-cases/class/create-class.use-case";
import { GetClassByIdUseCase } from "@/application/class-management/use-cases/class/get-class-by-id.use-case";
import { GetAllClassesUseCase } from "@/application/class-management/use-cases/class/get-all-classes.use-case";
import { UpdateClassUseCase } from "@/application/class-management/use-cases/class/update-class.use-case";
import { DeleteClassUseCase } from "@/application/class-management/use-cases/class/delete-class.use-case";

// Use Cases - Reference Data
import { GetAllGradeLevelsUseCase } from "@/application/class-management/use-cases/reference-data/get-all-grade-levels.use-case";
import { GetAllSchoolYearsUseCase } from "@/application/class-management/use-cases/reference-data/get-all-school-years.use-case";
import { GetSchoolYearByIdUseCase } from "@/application/class-management/use-cases/reference-data/get-school-year-by-id.use-case";

// Use Cases - School Year CUD
import { CreateSchoolYearUseCase } from "@/application/class-management/use-cases/school-year/create-school-year.use-case";
import { UpdateSchoolYearUseCase } from "@/application/class-management/use-cases/school-year/update-school-year.use-case";
import { DeleteSchoolYearUseCase } from "@/application/class-management/use-cases/school-year/delete-school-year.use-case";

// Use Cases - Grade Level CUD
import { CreateGradeLevelUseCase } from "@/application/class-management/use-cases/grade-level/create-grade-level.use-case";
import { GetGradeLevelByIdUseCase } from "@/application/class-management/use-cases/grade-level/get-grade-level-by-id.use-case";
import { UpdateGradeLevelUseCase } from "@/application/class-management/use-cases/grade-level/update-grade-level.use-case";
import { DeleteGradeLevelUseCase } from "@/application/class-management/use-cases/grade-level/delete-grade-level.use-case";
import { ReorderGradeLevelsUseCase } from "@/application/class-management/use-cases/grade-level/reorder-grade-levels.use-case";

// Use Cases - School Year Get By ID
import { GetSchoolYearByIdUseCase } from "@/application/class-management/use-cases/school-year/get-school-year-by-id.use-case";

// Use Cases - Enrollment
import { EnrollStudentUseCase } from "@/application/class-management/use-cases/enrollment/enroll-student.use-case";
import { WithdrawStudentUseCase } from "@/application/class-management/use-cases/enrollment/withdraw-student.use-case";
import { TransferStudentUseCase } from "@/application/class-management/use-cases/enrollment/transfer-student.use-case";
import { BulkEnrollStudentsUseCase } from "@/application/class-management/use-cases/enrollment/bulk-enroll-students.use-case";
import { BulkTransferStudentsUseCase } from "@/application/class-management/use-cases/enrollment/bulk-transfer-students.use-case";
import { GetClassEnrollmentsUseCase } from "@/application/class-management/use-cases/enrollment/get-class-enrollments.use-case";
import { GetStudentEnrollmentHistoryUseCase } from "@/application/class-management/use-cases/enrollment/get-student-enrollment-history.use-case";

// Use Cases - School Year Enrollment
import { RegisterForSchoolYearUseCase } from "@/application/class-management/use-cases/school-year-enrollment/register-for-school-year.use-case";
import { WithdrawFromSchoolUseCase } from "@/application/class-management/use-cases/school-year-enrollment/withdraw-from-school.use-case";
import { GetStudentSchoolYearHistoryUseCase } from "@/application/class-management/use-cases/school-year-enrollment/get-student-school-year-history.use-case";

// Use Cases - Eligible Students (file lives in user-management; registered here to keep
// CLASS_REPOSITORY + STUDENT_REPOSITORY co-located without a forwardRef cycle.)
import { GetEligibleStudentsForClassUseCase } from "@/application/user-management/use-cases/student/get-eligible-students-for-class.use-case";

// Use Cases - Eligible Staff (file lives in user-management; registered here to keep
// CLASS_REPOSITORY + STAFF_REPOSITORY co-located without a forwardRef cycle.)
import { GetEligibleStaffForClassUseCase } from "@/application/user-management/use-cases/staff/get-eligible-staff-for-class.use-case";

// Use Cases - Class Staff
import { AssignStaffToClassUseCase } from "@/application/class-management/use-cases/class-staff/assign-staff-to-class.use-case";
import { BulkAssignStaffToClassUseCase } from "@/application/class-management/use-cases/class-staff/bulk-assign-staff-to-class.use-case";
import { GetClassStaffUseCase } from "@/application/class-management/use-cases/class-staff/get-class-staff.use-case";
import { RemoveStaffFromClassUseCase } from "@/application/class-management/use-cases/class-staff/remove-staff-from-class.use-case";
import { ChangeClassStaffRoleUseCase } from "@/application/class-management/use-cases/class-staff/change-class-staff-role.use-case";

// Repositories
import { PrismaClassRepository } from "@/infra/persistence/prisma/repositories/prisma-class.repository";
import { PrismaGradeLevelRepository } from "@/infra/persistence/prisma/repositories/prisma-grade-level.repository";
import { PrismaSchoolYearRepository } from "@/infra/persistence/prisma/repositories/prisma-school-year.repository";
import { PrismaEnrollmentRepository } from "@/infra/persistence/prisma/repositories/prisma-enrollment.repository";
import { PrismaSchoolYearEnrollmentRepository } from "@/infra/persistence/prisma/repositories/prisma-school-year-enrollment.repository";
import { PrismaClassStaffRepository } from "@/infra/persistence/prisma/repositories/prisma-class-staff.repository";

// Modules
import { PrismaModule } from "@/infra/persistence/prisma/prisma.module";
import { StandardResponseModule } from "@/core/modules/standard-response/standard-response.module";
import { UserManagementModule } from "./user-management.module";
import { CampusModule } from "./campus.module";
import { RequestContextModule } from "../context/request-context.module";

/**
 * Class Management Module
 *
 * HTTP presentation module for class and enrollment management.
 * Follows Clean Architecture with clear layer separation.
 */
@Module({
  imports: [
    PrismaModule,
    StandardResponseModule,
    UserManagementModule, // For STUDENT_REPOSITORY, USER_REPOSITORY access
    CampusModule, // For CAMPUS_REPOSITORY (CampusGuard)
    RequestContextModule, // Provides RequestContext for CampusGuard
  ],
  controllers: [
    ClassController,
    ReferenceDataController,
    StudentEnrollmentController,
    SchoolYearEnrollmentController,
    SchoolYearEnrollmentLifecycleController,
  ],
  providers: [
    // Class Use Cases
    CreateClassUseCase,
    GetClassByIdUseCase,
    GetAllClassesUseCase,
    UpdateClassUseCase,
    DeleteClassUseCase,

    // Reference Data Use Cases
    GetAllGradeLevelsUseCase,
    GetAllSchoolYearsUseCase,
    GetSchoolYearByIdUseCase,

    // School Year CUD Use Cases
    CreateSchoolYearUseCase,
    UpdateSchoolYearUseCase,
    DeleteSchoolYearUseCase,

    // Grade Level CUD Use Cases
    CreateGradeLevelUseCase,
    GetGradeLevelByIdUseCase,
    UpdateGradeLevelUseCase,
    DeleteGradeLevelUseCase,
    ReorderGradeLevelsUseCase,

    // School Year Get By ID Use Case
    GetSchoolYearByIdUseCase,

    // Enrollment Use Cases
    EnrollStudentUseCase,
    WithdrawStudentUseCase,
    TransferStudentUseCase,
    BulkEnrollStudentsUseCase,
    BulkTransferStudentsUseCase,
    GetClassEnrollmentsUseCase,
    GetStudentEnrollmentHistoryUseCase,
    GetEligibleStudentsForClassUseCase,
    GetEligibleStaffForClassUseCase,

    // Class Staff Use Cases
    AssignStaffToClassUseCase,
    BulkAssignStaffToClassUseCase,
    GetClassStaffUseCase,
    RemoveStaffFromClassUseCase,
    ChangeClassStaffRoleUseCase,

    // School Year Enrollment Use Cases
    RegisterForSchoolYearUseCase,
    WithdrawFromSchoolUseCase,
    GetStudentSchoolYearHistoryUseCase,

    // Repositories
    {
      provide: "CLASS_REPOSITORY",
      useClass: PrismaClassRepository,
    },
    {
      provide: "GRADE_LEVEL_REPOSITORY",
      useClass: PrismaGradeLevelRepository,
    },
    {
      provide: "SCHOOL_YEAR_REPOSITORY",
      useClass: PrismaSchoolYearRepository,
    },
    {
      provide: "ENROLLMENT_REPOSITORY",
      useClass: PrismaEnrollmentRepository,
    },
    {
      provide: "SCHOOL_YEAR_ENROLLMENT_REPOSITORY",
      useClass: PrismaSchoolYearEnrollmentRepository,
    },
    {
      provide: "CLASS_STAFF_REPOSITORY",
      useClass: PrismaClassStaffRepository,
    },
  ],
  exports: [
    "CLASS_REPOSITORY",
    "GRADE_LEVEL_REPOSITORY",
    "SCHOOL_YEAR_REPOSITORY",
    "ENROLLMENT_REPOSITORY",
    "SCHOOL_YEAR_ENROLLMENT_REPOSITORY",
    "CLASS_STAFF_REPOSITORY",
  ],
})
export class ClassManagementModule {}
