import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { CleanupTask } from "./tasks/cleanup.task";

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [CleanupTask],
})
export class CronjobModule {}
