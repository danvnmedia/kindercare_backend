import { Module } from '@nestjs/common';
import { UserController } from './controllers/user.controller';
import { UserManagementModule } from '@/application/user-management/user-management.module';
import { PersistenceModule } from '@/infra/persistence/persistence.module';

@Module({
    imports: [UserManagementModule, PersistenceModule],
    controllers: [UserController],
})
export class HttpModule {}