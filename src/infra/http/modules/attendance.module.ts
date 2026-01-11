import { Module } from "@nestjs/common";

// Controller
import { AttendanceController } from "../controllers/attendance.controller";

// Use Cases
import { RecordAttendanceUseCase } from "@/application/attendance/use-cases/record-attendance.use-case";
import { UpdateAttendanceUseCase } from "@/application/attendance/use-cases/update-attendance.use-case";
import { GetAttendanceByIdUseCase } from "@/application/attendance/use-cases/get-attendance-by-id.use-case";
import { GetClassAttendanceUseCase } from "@/application/attendance/use-cases/get-class-attendance.use-case";
import { GetStudentAttendanceUseCase } from "@/application/attendance/use-cases/get-student-attendance.use-case";
import { BulkRecordAttendanceUseCase } from "@/application/attendance/use-cases/bulk-record-attendance.use-case";

// Repository
import { PrismaStudentAttendanceRepository } from "@/infra/persistence/prisma/repositories/prisma-student-attendance.repository";

// Modules
import { PrismaModule } from "@/infra/persistence/prisma/prisma.module";
import { StandardResponseModule } from "@/core/modules/standard-response/standard-response.module";
import { UserManagementModule } from "./user-management.module";
import { ClassManagementModule } from "./class-management.module";
import { CampusModule } from "./campus.module";

/**
 * Attendance Module
 *
 * HTTP presentation module for student attendance management.
 * Follows Clean Architecture with clear layer separation.
 */
@Module({
  imports: [
    PrismaModule,
    StandardResponseModule,
    UserManagementModule, // For STUDENT_REPOSITORY, USER_REPOSITORY access
    ClassManagementModule, // For CLASS_REPOSITORY access
    CampusModule, // For CAMPUS_REPOSITORY (CampusGuard)
  ],
  controllers: [AttendanceController],
  providers: [
    // Use Cases
    RecordAttendanceUseCase,
    UpdateAttendanceUseCase,
    GetAttendanceByIdUseCase,
    GetClassAttendanceUseCase,
    GetStudentAttendanceUseCase,
    BulkRecordAttendanceUseCase,

    // Repository
    {
      provide: "STUDENT_ATTENDANCE_REPOSITORY",
      useClass: PrismaStudentAttendanceRepository,
    },
  ],
  exports: ["STUDENT_ATTENDANCE_REPOSITORY"],
})
export class AttendanceModule {}
