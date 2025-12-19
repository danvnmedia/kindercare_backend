/**
 * User Domain Entity
 * Framework-agnostic pure TypeScript entity
 * NO NestJS decorators allowed in this layer
 *
 * NOTE: User ONLY contains authentication information.
 * User can be either a Guardian or Staff (NOT Student - kindergarten kids don't login)
 */

import { Entity } from "@/core/entities/entity";
import { UniqueEntityID } from "@/core/entities/unique-entity-id";
import { Role } from "./role.entity";

/**
 * User entity properties
 */
export interface UserProps {
  clerkUid: string; // Required - Clerk authentication ID
  isActive: boolean;
  name?: string;
  email?: string;
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

  get roles(): Role[] | undefined {
    return this.props.roles;
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
   * Check if user has specific role
   */
  public hasRole(roleId: string): boolean {
    return this.props.roles?.some((role) => role.id === roleId) ?? false;
  }

  /**
   * Check if user has any of the specified roles
   */
  public hasAnyRole(roleIds: string[]): boolean {
    return roleIds.some((roleId) => this.hasRole(roleId));
  }

  /**
   * Check if user has all specified roles
   */
  public hasAllRoles(roleIds: string[]): boolean {
    return roleIds.every((roleId) => this.hasRole(roleId));
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
      roles: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return new User(userProps, id ? new UniqueEntityID(id) : undefined);
  }

  /**
   * Reconstitute User entity from persistence (with all fields including roles)
   * Used by mappers when loading from database
   */
  public static reconstitute(props: UserProps, id: string): User {
    return new User(props, new UniqueEntityID(id));
  }
}
