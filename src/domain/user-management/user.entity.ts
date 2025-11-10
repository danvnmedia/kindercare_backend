/**
 * User Domain Entity
 * Framework-agnostic pure TypeScript entity
 * NO NestJS decorators allowed in this layer
 */

export interface User {
  id: number;
  email: string | null;
  fullName: string | null;
  phoneNumber: string | null;
  address: string | null;
  dateOfBirth: Date | null;
  clerkUid: string | null;
  isActive: boolean;
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
   * Validate phone number format (basic validation for Vietnamese numbers)
   */
  static validatePhoneNumber(phoneNumber: string): boolean {
    // Vietnamese phone number: 10-11 digits, starting with 0
    const phoneRegex = /^0\d{9,10}$/;
    return phoneRegex.test(phoneNumber);
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
