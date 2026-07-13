import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { ExpireInactiveSchoolYearLifecycleRunsUseCase } from "@/application/class-management/use-cases/school-year-lifecycle";
import { FileRepository } from "@/application/file-management/ports/file.repository";
import { CleanupStalePendingUploadsUseCase } from "@/application/file-management/use-cases/cleanup-stale-pending-uploads.use-case";
import { StandardResponseModule } from "@/core/modules/standard-response";
import { PrismaModule } from "@/infra/persistence/prisma/prisma.module";
import { PrismaFileRepository } from "@/infra/persistence/prisma/repositories/prisma-file.repository";
import { PrismaSchoolYearLifecycleRepository } from "@/infra/persistence/prisma/repositories/prisma-school-year-lifecycle.repository";
import { StorageModule } from "@/infra/storage/storage.module";
import { CleanupTask } from "./tasks/cleanup.task";
import { SchoolYearLifecycleExpirationTask } from "./tasks/school-year-lifecycle-expiration.task";

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    StorageModule,
    StandardResponseModule,
  ],
  providers: [
    CleanupTask,
    CleanupStalePendingUploadsUseCase,
    {
      provide: FileRepository,
      useClass: PrismaFileRepository,
    },
    SchoolYearLifecycleExpirationTask,
    ExpireInactiveSchoolYearLifecycleRunsUseCase,
    {
      provide: "SCHOOL_YEAR_LIFECYCLE_REPOSITORY",
      useClass: PrismaSchoolYearLifecycleRepository,
    },
  ],
})
export class CronjobModule {}
