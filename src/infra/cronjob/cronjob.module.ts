import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { CleanupTask } from "./tasks/cleanup.task";
import { PrismaModule } from "@/infra/persistence/prisma/prisma.module";
import { PrismaSchoolYearLifecycleRepository } from "@/infra/persistence/prisma/repositories/prisma-school-year-lifecycle.repository";
import { ExpireInactiveSchoolYearLifecycleRunsUseCase } from "@/application/class-management/use-cases/school-year-lifecycle";
import { SchoolYearLifecycleExpirationTask } from "./tasks/school-year-lifecycle-expiration.task";

@Module({
  imports: [ScheduleModule.forRoot(), PrismaModule],
  providers: [
    CleanupTask,
    SchoolYearLifecycleExpirationTask,
    ExpireInactiveSchoolYearLifecycleRunsUseCase,
    {
      provide: "SCHOOL_YEAR_LIFECYCLE_REPOSITORY",
      useClass: PrismaSchoolYearLifecycleRepository,
    },
  ],
})
export class CronjobModule {}
