import { Module, forwardRef } from "@nestjs/common";

// Controller
import { StaffTypeController } from "../controllers/user-management/staff-type.controller";

// Use Cases
import { CreateStaffTypeUseCase } from "@/application/user-management/use-cases/staff-type/create-staff-type.use-case";
import { GetStaffTypeByIdUseCase } from "@/application/user-management/use-cases/staff-type/get-staff-type-by-id.use-case";
import { GetAllStaffTypesUseCase } from "@/application/user-management/use-cases/staff-type/get-all-staff-types.use-case";
import { UpdateStaffTypeUseCase } from "@/application/user-management/use-cases/staff-type/update-staff-type.use-case";
import { DeleteStaffTypeUseCase } from "@/application/user-management/use-cases/staff-type/delete-staff-type.use-case";

// Repository
import { PrismaStaffTypeRepository } from "@/infra/persistence/prisma/repositories/prisma-staff-type.repository";

// Modules
import { PrismaModule } from "@/infra/persistence/prisma/prisma.module";
import { StandardResponseModule } from "@/core/modules/standard-response/standard-response.module";
import { UserManagementModule } from "./user-management.module";
import { RequestContextModule } from "../context/request-context.module";
import { CampusModule } from "./campus.module";

/**
 * Staff Type Module
 *
 * HTTP presentation module for staff type management.
 * Follows Clean Architecture with clear layer separation.
 *
 * Staff types are used to categorize staff members within a campus
 * (e.g., Teacher, Administrator, Support Staff).
 */
@Module({
  imports: [
    PrismaModule, // Database access
    StandardResponseModule, // Query service for filtering and pagination
    forwardRef(() => UserManagementModule), // For ROLE_REPOSITORY dependency (circular dep)
    RequestContextModule, // Provides RequestContext for ClerkAuthGuard
    CampusModule, // Provides CAMPUS_REPOSITORY for CampusGuard
  ],
  controllers: [StaffTypeController],
  providers: [
    // Use Cases
    CreateStaffTypeUseCase,
    GetStaffTypeByIdUseCase,
    GetAllStaffTypesUseCase,
    UpdateStaffTypeUseCase,
    DeleteStaffTypeUseCase,

    // Repository
    {
      provide: "STAFF_TYPE_REPOSITORY",
      useClass: PrismaStaffTypeRepository,
    },
  ],
  exports: ["STAFF_TYPE_REPOSITORY"],
})
export class StaffTypeModule {}
