import { Module, NestModule, MiddlewareConsumer } from "@nestjs/common";
import { UserManagementModule } from "./modules/user-management.module";
import { AuthModule } from "./modules/auth.module";
import { AuditModule } from "./modules/audit.module";
import { FileManagementModule } from "./modules/file-management/file-management.module";
import { ClassManagementModule } from "./modules/class-management.module";
import { CampusModule } from "./modules/campus.module";
import { StaffTypeModule } from "./modules/staff-type.module";
import { GuardianRelationshipTypeModule } from "./modules/guardian-relationship-type.module";
import { ContentManagementModule } from "./modules/content-management.module";
import { AttendanceModule } from "./modules/attendance.module";
import { MealMenuModule } from "./modules/meal-menu.module";
import { WeeklyPlanModule } from "./modules/weekly-plan.module";
import { AbsenceRequestModule } from "./modules/absence-request.module";
import { MedicationModule } from "./modules/medication.module";
import { StudentHealthModule } from "./modules/student-health.module";
import { AuthMiddleware } from "./middleware/auth.middleware";
import { ClerkModule } from "@/infra/external-services/clerk/clerk.module";

/**
 * HTTP Module
 *
 * Main HTTP module that aggregates all feature modules.
 * This module is imported by AppModule.
 *
 * Authentication Flow (Hybrid Pattern):
 * 1. AuthMiddleware (global) - Verifies Clerk token, sets clerkId/sessionId
 * 2. ClerkAuthGuard - Checks authentication exists (rejects if missing)
 * 3. CampusGuard/RolesGuard/PermissionsGuard - Uses RequestContext for cached user
 *
 * @see @doc/architecture/adr-hybrid-authentication-context-architecture for details
 */
@Module({
  imports: [
    ClerkModule, // Provides AUTHENTICATION_PORT for AuthMiddleware
    AuthModule, // Authentication endpoints
    UserManagementModule, // User & Role management
    FileManagementModule, // File management
    ClassManagementModule, // Class & Enrollment management
    CampusModule, // Campus management
    StaffTypeModule, // Staff type management
    GuardianRelationshipTypeModule, // Guardian relationship type management
    ContentManagementModule, // Post/CMS management
    AttendanceModule, // Student attendance management
    MealMenuModule, // Meal-menu management
    WeeklyPlanModule, // Weekly-plan schedule management
    AbsenceRequestModule, // Parent/admin absence request management
    MedicationModule, // Medication request and administration management
    StudentHealthModule, // Student profile health tab management
    AuditModule, // Admin audit-log read endpoints (@doc/specs/admin-audit-log)
  ],
  controllers: [],
})
export class HttpModule implements NestModule {
  /**
   * Configure global middleware
   *
   * AuthMiddleware is applied to all routes to:
   * - Verify Clerk authentication tokens
   * - Set clerkId/sessionId on request for downstream consumption
   * - Allow public routes to continue without authentication
   */
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).forRoutes("*");
  }
}
