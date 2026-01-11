import { Module } from "@nestjs/common";

// Controller
import { CampusController } from "../controllers/campus.controller";

// Use Cases
import { CreateCampusUseCase } from "@/application/campus/use-cases/create-campus.use-case";
import { GetCampusByIdUseCase } from "@/application/campus/use-cases/get-campus-by-id.use-case";
import { GetAllCampusesUseCase } from "@/application/campus/use-cases/get-all-campuses.use-case";
import { UpdateCampusUseCase } from "@/application/campus/use-cases/update-campus.use-case";
import { DeleteCampusUseCase } from "@/application/campus/use-cases/delete-campus.use-case";

// Repository
import { PrismaCampusRepository } from "@/infra/persistence/prisma/repositories/prisma-campus.repository";

// Modules
import { PrismaModule } from "@/infra/persistence/prisma/prisma.module";
import { StandardResponseModule } from "@/core/modules/standard-response/standard-response.module";

/**
 * Campus Module
 *
 * HTTP presentation module for campus management.
 * Follows Clean Architecture with clear layer separation.
 */
@Module({
  imports: [PrismaModule, StandardResponseModule],
  controllers: [CampusController],
  providers: [
    // Use Cases
    CreateCampusUseCase,
    GetCampusByIdUseCase,
    GetAllCampusesUseCase,
    UpdateCampusUseCase,
    DeleteCampusUseCase,

    // Repository
    {
      provide: "CAMPUS_REPOSITORY",
      useClass: PrismaCampusRepository,
    },
  ],
  exports: ["CAMPUS_REPOSITORY"],
})
export class CampusModule {}
