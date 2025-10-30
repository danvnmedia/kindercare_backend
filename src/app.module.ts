import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StandardResponseModule } from '@/core/modules/standard-response';
import { UserManagementModule } from '@/application/user-management/user-management.module';
import { HttpModule } from '@/infra/http/http.module';
import { PersistenceModule } from '@/infra/persistence/persistence.module';
import { QueueModule } from '@/infra/queue/queue.module';
import { CronjobModule } from '@/infra/cronjob/cronjob.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    StandardResponseModule,
    PersistenceModule,
    UserManagementModule,
    HttpModule,
    QueueModule,
    CronjobModule,
  ],
})
export class AppModule {}