/**
 * Teacher Domain Entity
 * Framework-agnostic pure TypeScript entity
 * NO NestJS decorators allowed in this layer
 */

/**
 * Teacher entity - represents a teacher profile
 */
export interface Teacher {
  id: string;

  fullName: string;
  email: string;
  phoneNumber: string;
  address: string | null;
  dateOfBirth: Date | null;
  gender: string | null;
  startDate: Date | null;

  userId: string | null;

  isArchived: boolean;

  createdAt: Date;
  updatedAt: Date;
}

/**
 * Teacher creation data (without generated fields)
 */
export interface CreateTeacherData {
  fullName: string;
  email: string;
  phoneNumber: string;
  address?: string | null;
  dateOfBirth?: Date | null;
  gender?: string | null;
  startDate?: Date | null;
  userId?: string | null;
}

/**
 * Teacher update data (partial)
 */
export interface UpdateTeacherData {
  fullName?: string;
  email?: string;
  phoneNumber?: string;
  address?: string | null;
  dateOfBirth?: Date | null;
  gender?: string | null;
  startDate?: Date | null;
  isArchived?: boolean;
}

/**
 * Teacher business rules and validation
 */
export class TeacherEntity {
  /**
   * Validate fullName (required, 2-100 characters)
   */
  static validateFullName(fullName: string): boolean {
    if (!fullName) return false;
    const trimmed = fullName.trim();
    return trimmed.length >= 2 && trimmed.length <= 100;
  }

  /**
   * Validate email format (required for teachers)
   */
  static validateEmail(email: string): boolean {
    if (!email) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate phone number format (required for teachers)
   * Supports Vietnamese phone format: +84xxxxxxxxx
   */
  static validatePhoneNumber(phoneNumber: string): boolean {
    if (!phoneNumber) return false;
    const phoneRegex = /^\+84\d{9,10}$/;
    return phoneRegex.test(phoneNumber);
  }

  /**
   * Validate gender
   */
  static readonly VALID_GENDERS = ["MALE", "FEMALE", "OTHER"] as const;

  static validateGender(gender: string): boolean {
    return this.VALID_GENDERS.includes(gender as any);
  }

  /**
   * Update teacher profile
   */
  static updateProfile(teacher: Teacher, updates: UpdateTeacherData): Teacher {
    return {
      ...teacher,
      ...updates,
      updatedAt: new Date(),
    };
  }

  /**
   * Check if teacher is archived (soft deleted)
   */
  static isArchived(teacher: Teacher): boolean {
    return teacher.isArchived;
  }

  /**
   * Archive teacher (soft delete)
   */
  static archive(teacher: Teacher): Teacher {
    return {
      ...teacher,
      isArchived: true,
      updatedAt: new Date(),
    };
  }

  /**
   * Restore teacher from archive
   */
  static restore(teacher: Teacher): Teacher {
    return {
      ...teacher,
      isArchived: false,
      updatedAt: new Date(),
    };
  }

  /**
   * Check if teacher has user account
   */
  static hasUserAccount(teacher: Teacher): boolean {
    return teacher.userId !== null;
  }
}
