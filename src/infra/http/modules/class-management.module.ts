import { Module } from "@nestjs/common";

// Controllers
import { ClassController } from "../controllers/class-management/class.controller";
import { ReferenceDataController } from "../controllers/class-management/reference-data.controller";

// Use Cases - Class
import { CreateClassUseCase } from "@/application/class-management/use-cases/class/create-class.use-case";
import { GetClassByIdUseCase } from "@/application/class-management/use-cases/class/get-class-by-id.use-case";
import { GetAllClassesUseCase } from "@/application/class-management/use-cases/class/get-all-classes.use-case";
import { UpdateClassUseCase } from "@/application/class-management/use-cases/class/update-class.use-case";
import { DeleteClassUseCase } from "@/application/class-management/use-cases/class/delete-class.use-case";

// Use Cases - Reference Data
import { GetAllGradeLevelsUseCase } from "@/application/class-management/use-cases/reference-data/get-all-grade-levels.use-case";
import { GetAllSchoolYearsUseCase } from "@/application/class-management/use-cases/reference-data/get-all-school-years.use-case";
import { GetAllSubjectsUseCase } from "@/application/class-management/use-cases/reference-data/get-all-subjects.use-case";

// Use Cases - Enrollment
import { EnrollStudentUseCase } from "@/application/class-management/use-cases/enrollment/enroll-student.use-case";
import { GetClassEnrollmentsUseCase } from "@/application/class-management/use-cases/enrollment/get-class-enrollments.use-case";
import { UnenrollStudentUseCase } from "@/application/class-management/use-cases/enrollment/unenroll-student.use-case";

// Use Cases - Class Teacher
import { AssignTeacherToClassUseCase } from "@/application/class-management/use-cases/class-teacher/assign-teacher-to-class.use-case";
import { GetClassTeachersUseCase } from "@/application/class-management/use-cases/class-teacher/get-class-teachers.use-case";
import { RemoveTeacherFromClassUseCase } from "@/application/class-management/use-cases/class-teacher/remove-teacher-from-class.use-case";

// Repositories
import { PrismaClassRepository } from "@/infra/persistence/prisma/repositories/prisma-class.repository";
import { PrismaGradeLevelRepository } from "@/infra/persistence/prisma/repositories/prisma-grade-level.repository";
import { PrismaSchoolYearRepository } from "@/infra/persistence/prisma/repositories/prisma-school-year.repository";
import { PrismaSubjectRepository } from "@/infra/persistence/prisma/repositories/prisma-subject.repository";
import { PrismaEnrollmentRepository } from "@/infra/persistence/prisma/repositories/prisma-enrollment.repository";
import { PrismaClassTeacherRepository } from "@/infra/persistence/prisma/repositories/prisma-class-teacher.repository";

// Modules
import { PrismaModule } from "@/infra/persistence/prisma/prisma.module";
import { StandardResponseModule } from "@/core/modules/standard-response/standard-response.module";
import { UserManagementModule } from "./user-management.module";

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
    UserManagementModule, // For STUDENT_REPOSITORY access
  ],
  controllers: [ClassController, ReferenceDataController],
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
    GetAllSubjectsUseCase,

    // Enrollment Use Cases
    EnrollStudentUseCase,
    GetClassEnrollmentsUseCase,
    UnenrollStudentUseCase,

    // Class Teacher Use Cases
    AssignTeacherToClassUseCase,
    GetClassTeachersUseCase,
    RemoveTeacherFromClassUseCase,

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
      provide: "SUBJECT_REPOSITORY",
      useClass: PrismaSubjectRepository,
    },
    {
      provide: "ENROLLMENT_REPOSITORY",
      useClass: PrismaEnrollmentRepository,
    },
    {
      provide: "CLASS_TEACHER_REPOSITORY",
      useClass: PrismaClassTeacherRepository,
    },
  ],
  exports: [
    "CLASS_REPOSITORY",
    "GRADE_LEVEL_REPOSITORY",
    "SCHOOL_YEAR_REPOSITORY",
    "SUBJECT_REPOSITORY",
    "ENROLLMENT_REPOSITORY",
    "CLASS_TEACHER_REPOSITORY",
  ],
})
export class ClassManagementModule {}
