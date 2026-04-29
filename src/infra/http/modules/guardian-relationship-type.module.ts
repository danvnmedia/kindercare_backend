import { Module } from "@nestjs/common";

// Controller
import { GuardianRelationshipTypeController } from "../controllers/user-management/guardian-relationship-type.controller";

// Use Cases
import { CreateGuardianRelationshipTypeUseCase } from "@/application/user-management/use-cases/guardian-relationship-type/create-guardian-relationship-type.use-case";
import { GetGuardianRelationshipTypeByIdUseCase } from "@/application/user-management/use-cases/guardian-relationship-type/get-guardian-relationship-type-by-id.use-case";
import { GetAllGuardianRelationshipTypesUseCase } from "@/application/user-management/use-cases/guardian-relationship-type/get-all-guardian-relationship-types.use-case";
import { UpdateGuardianRelationshipTypeUseCase } from "@/application/user-management/use-cases/guardian-relationship-type/update-guardian-relationship-type.use-case";
import { DeleteGuardianRelationshipTypeUseCase } from "@/application/user-management/use-cases/guardian-relationship-type/delete-guardian-relationship-type.use-case";
import { RestoreGuardianRelationshipTypeUseCase } from "@/application/user-management/use-cases/guardian-relationship-type/restore-guardian-relationship-type.use-case";
import { ReorderGuardianRelationshipTypesUseCase } from "@/application/user-management/use-cases/guardian-relationship-type/reorder-guardian-relationship-types.use-case";

// Repository
import { PrismaGuardianRelationshipTypeRepository } from "@/infra/persistence/prisma/repositories/prisma-guardian-relationship-type.repository";

// Modules
import { PrismaModule } from "@/infra/persistence/prisma/prisma.module";
import { StandardResponseModule } from "@/core/modules/standard-response/standard-response.module";
import { RequestContextModule } from "../context/request-context.module";
import { CampusModule } from "./campus.module";

/**
 * Guardian Relationship Type Module
 *
 * HTTP presentation module for guardian relationship type management.
 * Follows Clean Architecture with clear layer separation.
 *
 * Guardian relationship types are campus-scoped reference data used to
 * categorize guardian-student relationships (e.g., Father, Mother, Uncle).
 */
@Module({
  imports: [
    PrismaModule,
    StandardResponseModule,
    RequestContextModule,
    CampusModule,
  ],
  controllers: [GuardianRelationshipTypeController],
  providers: [
    // Use Cases
    CreateGuardianRelationshipTypeUseCase,
    GetGuardianRelationshipTypeByIdUseCase,
    GetAllGuardianRelationshipTypesUseCase,
    UpdateGuardianRelationshipTypeUseCase,
    DeleteGuardianRelationshipTypeUseCase,
    RestoreGuardianRelationshipTypeUseCase,
    ReorderGuardianRelationshipTypesUseCase,

    // Repository
    {
      provide: "GUARDIAN_RELATIONSHIP_TYPE_REPOSITORY",
      useClass: PrismaGuardianRelationshipTypeRepository,
    },
  ],
  exports: ["GUARDIAN_RELATIONSHIP_TYPE_REPOSITORY"],
})
export class GuardianRelationshipTypeModule {}
