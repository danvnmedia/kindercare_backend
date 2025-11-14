import { Module } from '@nestjs/common';
import { UserManagementModule } from './modules/user-management.module';
import { AuthModule } from './modules/auth.module';

/**
 * HTTP Module
 *
 * Main HTTP module that aggregates all feature modules.
 * This module is imported by AppModule.
 */
@Module({
  imports: [
    AuthModule, // Authentication endpoints
    UserManagementModule, // User & Role management
  ],
  controllers: [],
})
export class HttpModule {}
