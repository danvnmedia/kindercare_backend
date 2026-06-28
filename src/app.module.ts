import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { StandardResponseModule } from "@/core/modules/standard-response";
import { HttpModule } from "@/infra/http/http.module";
import { QueueModule } from "@/infra/queue/queue.module";
import { CronjobModule } from "@/infra/cronjob/cronjob.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    StandardResponseModule,
    HttpModule,
    QueueModule,
    CronjobModule,
  ],
})
export class AppModule {}
