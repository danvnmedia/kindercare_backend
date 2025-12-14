import { Module } from "@nestjs/common";
import { UserManagementModule } from "./modules/user-management.module";
import { AuthModule } from "./modules/auth.module";
import { FileManagementModule } from "./modules/file-management/file-management.module";
import { ClassManagementModule } from "./modules/class-management.module";

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
    FileManagementModule, // File management
    ClassManagementModule, // Class & Enrollment management
  ],
  controllers: [],
})
export class HttpModule {}
