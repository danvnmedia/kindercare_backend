import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { CleanupTask } from "./tasks/cleanup.task";
import { CleanupStalePendingUploadsUseCase } from "@/application/file-management/use-cases/cleanup-stale-pending-uploads.use-case";
import { FileRepository } from "@/application/file-management/ports/file.repository";
import { PrismaFileRepository } from "@/infra/persistence/prisma/repositories/prisma-file.repository";
import { PrismaModule } from "@/infra/persistence/prisma/prisma.module";
import { StorageModule } from "@/infra/storage/storage.module";
import { StandardResponseModule } from "@/core/modules/standard-response";

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
  ],
})
export class CronjobModule {}
