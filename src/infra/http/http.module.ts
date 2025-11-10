import { Module } from '@nestjs/common';
import { UserManagementModule } from './modules/user-management.module';

@Module({
    imports: [UserManagementModule],
    controllers: [],
})
export class HttpModule {}