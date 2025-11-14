/**
 * User Domain Entity
 * Framework-agnostic pure TypeScript entity
 * NO NestJS decorators allowed in this layer
 */

import { Role } from "./role.entity";

export interface User {
  id: string;
  email: string | null;
  fullName: string | null;
  phoneNumber: string | null;
  address: string | null;
  dateOfBirth: Date | null;
  clerkUid: string | null;
  isActive: boolean;
  roles?: Role[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User creation data (without generated fields)
 */
export interface CreateUserData {
  email?: string | null;
  fullName?: string | null;
  phoneNumber?: string | null;
  address?: string | null;
  dateOfBirth?: Date | null;
  clerkUid?: string | null;
  isActive?: boolean;
}

/**
 * User update data (partial)
 */
export interface UpdateUserData {
  email?: string | null;
  fullName?: string | null;
  phoneNumber?: string | null;
  address?: string | null;
  dateOfBirth?: Date | null;
  isActive?: boolean;
}

/**
 * User business rules and validation
 */
export class UserEntity {
  /**
   * Validate that at least one contact method is provided
   */
  static validateContactInfo(data: CreateUserData): void {
    if (!data.email && !data.phoneNumber) {
      throw new Error('At least one of email or phone number must be provided');
    }
  }

  /**
   * Validate email format (basic validation)
   */
  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate phone number format (E.164 international standard)
   * Vietnamese: +84 followed by 9-10 digits
   * Example: +84912345678
   */
  static validatePhoneNumber(phoneNumber: string): boolean {
    // E.164 format: +84 followed by 9-10 digits
    const e164Regex = /^\+84\d{9,10}$/;
    return e164Regex.test(phoneNumber);
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
    return { ...user, isActive: true };
  }

  /**
   * Deactivate user
   */
  static deactivate(user: User): User {
    return { ...user, isActive: false };
  }

  /**
   * Update user profile
   */
  static updateProfile(user: User, updates: UpdateUserData): User {
    return {
      ...user,
      ...updates,
      updatedAt: new Date(),
    };
  }
}
