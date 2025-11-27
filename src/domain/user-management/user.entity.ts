/**
 * User Domain Entity
 * Framework-agnostic pure TypeScript entity
 * NO NestJS decorators allowed in this layer
 *
 * NOTE: User ONLY contains authentication information.
 * User can be either a Parent or Teacher (NOT Student - kindergarten kids don't login)
 */

import { Role } from './role.entity';

/**
 * User entity - represents authentication capability
 * Can link to Parent or TeacherProfile for additional profile information
 */
export interface User {
  id: string;
  clerkUid: string; // Required - Clerk authentication ID
  isActive: boolean;
  roles?: Role[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User creation data (without generated fields)
 */
export interface CreateUserData {
  clerkUid: string; // Required
  isActive?: boolean;
}

/**
 * User update data (partial)
 */
export interface UpdateUserData {
  isActive?: boolean;
  // clerkUid cannot be updated after creation
}

/**
 * User business rules and validation
 */
export class UserEntity {
  /**
   * Validate Clerk UID format
   * Clerk UIDs typically start with "user_" followed by random characters
   */
  static validateClerkUid(clerkUid: string): boolean {
    if (!clerkUid || clerkUid.trim().length === 0) {
      return false;
    }
    // Basic validation: should start with "user_" or "clerk_"
    const clerkUidRegex = /^(user_|clerk_)[a-zA-Z0-9]+$/;
    return clerkUidRegex.test(clerkUid);
  }

  /**
   * Check if user is active
   */
  static isActive(user: User): boolean {
    return user.isActive;
  }

  /**
   * Activate user
   */
  static activate(user: User): User {
    return { ...user, isActive: true, updatedAt: new Date() };
  }

  /**
   * Deactivate user
   */
  static deactivate(user: User): User {
    return { ...user, isActive: false, updatedAt: new Date() };
  }

  /**
   * Update user
   */
  static update(user: User, updates: UpdateUserData): User {
    return {
      ...user,
      ...updates,
      updatedAt: new Date(),
    };
  }

  /**
   * Check if user has specific role
   */
  static hasRole(user: User, roleId: string): boolean {
    return user.roles?.some((role) => role.id === roleId) ?? false;
  }

  /**
   * Check if user has any of the specified roles
   */
  static hasAnyRole(user: User, roleIds: string[]): boolean {
    return roleIds.some((roleId) => this.hasRole(user, roleId));
  }

  /**
   * Check if user has all specified roles
   */
  static hasAllRoles(user: User, roleIds: string[]): boolean {
    return roleIds.every((roleId) => this.hasRole(user, roleId));
  }
}
