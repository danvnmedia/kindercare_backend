import { Module } from "@nestjs/common";
import { UserManagementModule } from "./modules/user-management.module";
import { AuthModule } from "./modules/auth.module";
import { FileManagementModule } from "./modules/file-management/file-management.module";
import { ClassManagementModule } from "./modules/class-management.module";
import { CampusModule } from "./modules/campus.module";
import { StaffTypeModule } from "./modules/staff-type.module";
import { ContentManagementModule } from "./modules/content-management.module";
import { AttendanceModule } from "./modules/attendance.module";

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
    CampusModule, // Campus management
    StaffTypeModule, // Staff type management
    ContentManagementModule, // Post/CMS management
    AttendanceModule, // Student attendance management
  ],
  controllers: [],
})
export class HttpModule {}
