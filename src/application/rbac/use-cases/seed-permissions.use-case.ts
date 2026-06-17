import { Injectable, Inject, Logger } from "@nestjs/common";
import { CreatePermissionData } from "@/domain/rbac";
import { PermissionRepository } from "../ports/permission.repository";

/**
 * Predefined system permissions
 * These are seeded during system initialization
 */
export const SYSTEM_PERMISSIONS: CreatePermissionData[] = [
  // Campus permissions
  { id: "campus.create", module: "campus", description: "Create a new campus" },
  { id: "campus.read", module: "campus", description: "View campus details" },
  {
    id: "campus.update",
    module: "campus",
    description: "Update campus information",
  },
  { id: "campus.delete", module: "campus", description: "Delete a campus" },
  { id: "campus.list", module: "campus", description: "List all campuses" },

  // Student permissions
  {
    id: "student.create",
    module: "student",
    description: "Create a new student",
  },
  {
    id: "student.read",
    module: "student",
    description: "View student details",
  },
  {
    id: "student.update",
    module: "student",
    description: "Update student information",
  },
  { id: "student.delete", module: "student", description: "Delete a student" },
  { id: "student.list", module: "student", description: "List all students" },

  // Guardian permissions
  {
    id: "guardian.create",
    module: "guardian",
    description: "Create a new guardian",
  },
  {
    id: "guardian.read",
    module: "guardian",
    description: "View guardian details",
  },
  {
    id: "guardian.update",
    module: "guardian",
    description: "Update guardian information",
  },
  {
    id: "guardian.delete",
    module: "guardian",
    description: "Delete a guardian",
  },
  {
    id: "guardian.list",
    module: "guardian",
    description: "List all guardians",
  },

  // Staff permissions
  {
    id: "staff.create",
    module: "staff",
    description: "Create a new staff member",
  },
  { id: "staff.read", module: "staff", description: "View staff details" },
  {
    id: "staff.update",
    module: "staff",
    description: "Update staff information",
  },
  { id: "staff.delete", module: "staff", description: "Delete a staff member" },
  { id: "staff.list", module: "staff", description: "List all staff members" },

  // Class permissions
  { id: "class.create", module: "class", description: "Create a new class" },
  { id: "class.read", module: "class", description: "View class details" },
  {
    id: "class.update",
    module: "class",
    description: "Update class information",
  },
  { id: "class.delete", module: "class", description: "Delete a class" },
  { id: "class.list", module: "class", description: "List all classes" },

  // Grade Level permissions
  {
    id: "grade_level.create",
    module: "grade_level",
    description: "Create a new grade level",
  },
  {
    id: "grade_level.read",
    module: "grade_level",
    description: "View grade level details",
  },
  {
    id: "grade_level.update",
    module: "grade_level",
    description: "Update grade level information",
  },
  {
    id: "grade_level.delete",
    module: "grade_level",
    description: "Delete a grade level",
  },
  {
    id: "grade_level.list",
    module: "grade_level",
    description: "List all grade levels",
  },

  // School Year permissions
  {
    id: "school_year.create",
    module: "school_year",
    description: "Create a new school year",
  },
  {
    id: "school_year.read",
    module: "school_year",
    description: "View school year details",
  },
  {
    id: "school_year.update",
    module: "school_year",
    description: "Update school year information",
  },
  {
    id: "school_year.delete",
    module: "school_year",
    description: "Delete a school year",
  },
  {
    id: "school_year.list",
    module: "school_year",
    description: "List all school years",
  },

  // Post permissions
  { id: "post.create", module: "post", description: "Create a new post" },
  { id: "post.read", module: "post", description: "View post details" },
  { id: "post.update", module: "post", description: "Update post information" },
  { id: "post.delete", module: "post", description: "Delete a post" },
  { id: "post.list", module: "post", description: "List all posts" },

  // File permissions
  { id: "file.create", module: "file", description: "Upload a file" },
  { id: "file.read", module: "file", description: "View/download file" },
  { id: "file.delete", module: "file", description: "Delete a file" },
  { id: "file.list", module: "file", description: "List all files" },

  // Role permissions
  { id: "role.create", module: "role", description: "Create a new role" },
  { id: "role.read", module: "role", description: "View role details" },
  { id: "role.update", module: "role", description: "Update role information" },
  { id: "role.delete", module: "role", description: "Delete a role" },
  { id: "role.list", module: "role", description: "List all roles" },
  { id: "role.assign", module: "role", description: "Assign roles to users" },

  // User permissions
  { id: "user.create", module: "user", description: "Create a new user" },
  { id: "user.read", module: "user", description: "View user details" },
  { id: "user.update", module: "user", description: "Update user information" },
  { id: "user.delete", module: "user", description: "Delete a user" },
  { id: "user.list", module: "user", description: "List all users" },

  // Attendance permissions
  {
    id: "attendance.create",
    module: "attendance",
    description: "Record attendance",
  },
  {
    id: "attendance.read",
    module: "attendance",
    description: "View attendance records",
  },
  {
    id: "attendance.update",
    module: "attendance",
    description: "Update attendance records",
  },
  {
    id: "attendance.delete",
    module: "attendance",
    description: "Delete attendance records",
  },
  {
    id: "attendance.list",
    module: "attendance",
    description: "List attendance records",
  },

  // Staff Type permissions
  {
    id: "staff_type.create",
    module: "staff_type",
    description: "Create a new staff type",
  },
  {
    id: "staff_type.read",
    module: "staff_type",
    description: "View staff type details",
  },
  {
    id: "staff_type.update",
    module: "staff_type",
    description: "Update staff type information",
  },
  {
    id: "staff_type.delete",
    module: "staff_type",
    description: "Delete a staff type",
  },
  {
    id: "staff_type.list",
    module: "staff_type",
    description: "List all staff types",
  },

  // Report permissions
  { id: "report.export", module: "report", description: "Export reports" },
  { id: "report.read", module: "report", description: "View reports" },

  // Setting permissions
  {
    id: "setting.read",
    module: "setting",
    description: "View system settings",
  },
  {
    id: "setting.update",
    module: "setting",
    description: "Update system settings",
  },

  // Meal menu permissions
  {
    id: "meal_menu.list",
    module: "meal_menu",
    description: "List meal menus",
  },
  {
    id: "meal_menu.read",
    module: "meal_menu",
    description: "View meal menu details",
  },
  {
    id: "meal_menu.create",
    module: "meal_menu",
    description: "Create or copy meal menus",
  },
  {
    id: "meal_menu.update",
    module: "meal_menu",
    description: "Update or restore meal menus",
  },
  {
    id: "meal_menu.delete",
    module: "meal_menu",
    description: "Archive meal menus",
  },

  // Meal menu config permissions
  {
    id: "meal_menu_config.read",
    module: "meal_menu_config",
    description: "View meal menu configuration",
  },
  {
    id: "meal_menu_config.update",
    module: "meal_menu_config",
    description: "Update meal menu configuration",
  },
];

@Injectable()
export class SeedPermissionsUseCase {
  private readonly logger = new Logger(SeedPermissionsUseCase.name);

  constructor(
    @Inject("PERMISSION_REPOSITORY")
    private readonly permissionRepository: PermissionRepository,
  ) {}

  /**
   * Get all predefined system permissions
   */
  getSystemPermissions(): CreatePermissionData[] {
    return SYSTEM_PERMISSIONS;
  }

  /**
   * Seed all system permissions
   * This is idempotent - existing permissions will not be duplicated
   */
  async execute(): Promise<{ created: number; skipped: number }> {
    this.logger.log("Seeding system permissions...");

    let created = 0;
    let skipped = 0;

    for (const permissionData of SYSTEM_PERMISSIONS) {
      const exists = await this.permissionRepository.exists(permissionData.id);

      if (exists) {
        skipped++;
        continue;
      }

      try {
        await this.permissionRepository.save(permissionData);
        created++;
        this.logger.debug(`Created permission: ${permissionData.id}`);
      } catch (error) {
        this.logger.error(
          `Failed to create permission ${permissionData.id}: ${error}`,
        );
      }
    }

    this.logger.log(
      `Permissions seeding complete: ${created} created, ${skipped} skipped`,
    );

    return { created, skipped };
  }
}
