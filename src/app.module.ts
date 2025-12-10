import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { StandardResponseModule } from "@/core/modules/standard-response";
import { HttpModule } from "@/infra/http/http.module";
import { QueueModule } from "@/infra/queue/queue.module";
import { CronjobModule } from "@/infra/cronjob/cronjob.module";
import { FileManagementModule } from "./infra/http/modules/file-management/file-management.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    StandardResponseModule,
    HttpModule,
    QueueModule,
    FileManagementModule,
     CronjobModule,
  ],
})
export class AppModule {}
