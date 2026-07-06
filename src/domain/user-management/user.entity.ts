/**
 * User Domain Entity
 * Framework-agnostic pure TypeScript entity
 * NO NestJS decorators allowed in this layer
 *
 * NOTE: User ONLY contains authentication information.
 * User can link to Guardian and/or Staff profiles (NOT Student - kindergarten kids don't login)
 */

import { Entity } from "@/core/entities/entity";
import { UniqueEntityID } from "@/core/entities/unique-entity-id";
import { Role } from "./role.entity";

/**
 * Profile information from Guardian or Staff
 * Used for /auth/me endpoint response
 */
export interface UserProfile {
  type: "guardian" | "staff";
  id: string;
  campusId?: string | null;
  fullName: string;
  email: string | null;
  phoneNumber: string | null;
  dateOfBirth: Date | null;
  gender: string | null;
}

/**
 * Represents a role assignment with campus context
 * campusId indicates which campus the role is assigned for:
 * - null: global assignment (role applies everywhere)
 * - string: role only applies within that specific campus
 */
export interface UserRoleAssignment {
  role: Role;
  campusId: string | null; // The campus context for this assignment (null = global)
  assignedAt: Date;
}

/**
 * Input for assigning roles with campus context
 */
export interface RoleAssignmentInput {
  roleId: string;
  campusId?: string | null; // undefined or null = global assignment
}

/**
 * User entity properties
 */
export interface UserProps {
  clerkUid: string; // Required - Clerk authentication ID
  isActive: boolean;
  name?: string;
  email?: string;
  roleAssignments?: UserRoleAssignment[];
  profiles?: UserProfile[]; // Active Guardian and Staff profile info
  profile?: UserProfile | null; // Compatibility accessor source for existing actor-name callers
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User creation data (without generated fields)
 */
export interface CreateUserData {
  clerkUid: string; // Required
  isActive?: boolean;
  name?: string;
  email?: string;
}

/**
 * User update data (partial)
 */
export interface UpdateUserData {
  isActive?: boolean;
  name?: string;
  email?: string;
  // clerkUid cannot be updated after creation
}

/**
 * User entity - represents authentication capability
 * Can link to Guardian or Staff for additional profile information
 */
export class User extends Entity<UserProps> {
  // --- Getters ---

  get clerkUid(): string {
    return this.props.clerkUid;
  }

  get isActive(): boolean {
    return this.props.isActive;
  }

  get name(): string | undefined {
    return this.props.name;
  }

  get email(): string | undefined {
    return this.props.email;
  }

  get roleAssignments(): UserRoleAssignment[] | undefined {
    return this.props.roleAssignments;
  }

  get profiles(): UserProfile[] {
    if (this.props.profiles) {
      return this.props.profiles;
    }

    return this.props.profile ? [this.props.profile] : [];
  }

  get profile(): UserProfile | null | undefined {
    if (this.props.profile !== undefined) {
      return this.props.profile;
    }

    return this.profiles[0] ?? null;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  // --- Domain Methods ---

  /**
   * Activate user account
   */
  public activate(): void {
    this.props.isActive = true;
    this.touch();
  }

  /**
   * Deactivate user account
   */
  public deactivate(): void {
    this.props.isActive = false;
    this.touch();
  }

  /**
   * Update user information
   */
  public updateInfo(updates: UpdateUserData): void {
    if (updates.isActive !== undefined) {
      this.props.isActive = updates.isActive;
    }
    if (updates.name !== undefined) {
      this.props.name = updates.name;
    }
    if (updates.email !== undefined) {
      this.props.email = updates.email;
    }
    this.touch();
  }

  /**
   * Check if user has specific role by ID
   */
  public hasRole(roleId: string): boolean {
    return (
      this.props.roleAssignments?.some(
        (assignment) => assignment.role.id === roleId,
      ) ?? false
    );
  }

  /**
   * Check if user has any system role (grants global admin bypass)
   */
  public hasSystemRole(): boolean {
    return (
      this.props.roleAssignments?.some(
        (assignment) => assignment.role.isSystemRole,
      ) ?? false
    );
  }

  /**
   * Check if user has any of the specified roles (by ID)
   */
  public hasAnyRole(roleIds: string[]): boolean {
    return roleIds.some((roleId) => this.hasRole(roleId));
  }

  /**
   * Check if user has all specified roles (by ID)
   */
  public hasAllRoles(roleIds: string[]): boolean {
    return roleIds.every((roleId) => this.hasRole(roleId));
  }

  /**
   * Check if user has a specific role in a specific campus context
   * Returns true if:
   * - User has the role assigned globally (campusId = null in assignment), OR
   * - User has the role assigned specifically to the given campus
   *
   * @param roleId - The role ID to check
   * @param campusId - The campus context to check (null to check for global assignment only)
   */
  public hasRoleInCampus(roleId: string, campusId: string | null): boolean {
    const assignments = this.props.roleAssignments;
    if (!assignments || assignments.length === 0) {
      return false;
    }

    return assignments.some((assignment) => {
      if (assignment.role.id !== roleId) {
        return false;
      }
      // Global assignment (null) grants access everywhere
      if (assignment.campusId === null) {
        return true;
      }
      // Campus-specific assignment matches the requested campus
      return assignment.campusId === campusId;
    });
  }

  /**
   * Get all roles that apply to a specific campus
   * Returns:
   * - Roles assigned globally (campusId = null in assignment)
   * - Roles assigned specifically to the given campus
   *
   * @param campusId - The campus to get roles for (null returns only globally assigned roles)
   */
  public getRolesForCampus(campusId: string | null): Role[] {
    const assignments = this.props.roleAssignments;
    if (!assignments || assignments.length === 0) {
      return [];
    }

    return assignments
      .filter((assignment) => {
        // Include global assignments (apply everywhere)
        if (assignment.campusId === null) {
          return true;
        }
        // Include campus-specific assignments that match
        return assignment.campusId === campusId;
      })
      .map((assignment) => assignment.role);
  }

  /**
   * Get all globally assigned roles (campusId = null in assignment)
   * These roles apply across all campuses
   */
  public getGlobalRoles(): Role[] {
    const assignments = this.props.roleAssignments;
    if (!assignments || assignments.length === 0) {
      return [];
    }

    return assignments
      .filter((assignment) => assignment.campusId === null)
      .map((assignment) => assignment.role);
  }

  /**
   * Get role assignments for a specific campus (including global)
   */
  public getRoleAssignmentsForCampus(
    campusId: string | null,
  ): UserRoleAssignment[] {
    const assignments = this.props.roleAssignments;
    if (!assignments || assignments.length === 0) {
      return [];
    }

    return assignments.filter((assignment) => {
      // Include global assignments
      if (assignment.campusId === null) {
        return true;
      }
      // Include campus-specific assignments that match
      return assignment.campusId === campusId;
    });
  }

  /**
   * Check if user has any global role assignment (campusId = null)
   * Users with global roles have access to all campuses
   */
  public hasGlobalRole(): boolean {
    const assignments = this.props.roleAssignments;
    if (!assignments || assignments.length === 0) {
      return false;
    }

    return assignments.some((assignment) => assignment.campusId === null);
  }

  /**
   * Get unique campus IDs where the user has role assignments
   * Excludes global assignments (campusId = null)
   * Used to determine which campuses a user can access
   */
  public getAccessibleCampusIds(): string[] {
    const assignments = this.props.roleAssignments;
    if (!assignments || assignments.length === 0) {
      return [];
    }

    const campusIds = assignments
      .filter((assignment) => assignment.campusId !== null)
      .map((assignment) => assignment.campusId as string);

    // Return unique campus IDs
    return [...new Set(campusIds)];
  }

  /**
   * Update the 'updatedAt' timestamp
   */
  private touch(): void {
    this.props.updatedAt = new Date();
  }

  // --- Static Validation Methods ---

  /**
   * Validate Clerk UID format
   * Clerk UIDs typically start with "user_" followed by random characters
   */
  public static validateClerkUid(clerkUid: string): boolean {
    if (!clerkUid || clerkUid.trim().length === 0) {
      return false;
    }
    // Basic validation: should start with "user_" or "clerk_"
    const clerkUidRegex = /^(user_|clerk_)[a-zA-Z0-9]+$/;
    return clerkUidRegex.test(clerkUid);
  }

  // --- Factory Method ---

  /**
   * Creates a new User entity
   * @param props - The properties of the user
   * @param id - An optional ID
   * @returns A new User instance
   */
  public static create(props: CreateUserData, id?: string): User {
    // Validation
    if (!User.validateClerkUid(props.clerkUid)) {
      throw new Error(
        'Invalid Clerk UID format. Must start with "user_" or "clerk_"',
      );
    }

    const userProps: UserProps = {
      clerkUid: props.clerkUid,
      isActive: props.isActive ?? true,
      name: props.name,
      email: props.email,
      roleAssignments: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return new User(userProps, id ? new UniqueEntityID(id) : undefined);
  }

  /**
   * Reconstitute User entity from persistence
   * Used by mappers when loading from database
   */
  public static reconstitute(props: UserProps, id: string): User {
    return new User(props, new UniqueEntityID(id));
  }
}
