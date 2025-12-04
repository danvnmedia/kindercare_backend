/**
 * Student Domain Entity
 * Framework-agnostic pure TypeScript entity
 * NO NestJS decorators allowed in this layer
 */

/**
 * Student entity - represents a student in the school system
 * Personal information is now stored directly in Student (denormalized)
 */
export interface Student {
  id: string;
  studentCode: string;

  // Personal information (duplicated - no Person table)
  fullName: string;
  email: string | null;
  phoneNumber: string | null;
  address: string | null;
  dateOfBirth: Date | null;

  // Student-specific data
  nickname: string | null;
  gender: string | null; // "MALE", "FEMALE", "OTHER"

  // Guardian relationships
  guardians?: StudentGuardianInfo[];

  // Soft delete
  isArchived: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export interface StudentGuardianInfo {
  guardianId: string;
  fullName: string;
  email: string | null;
  phoneNumber: string | null;
  relationship: string;
  relationshipName: string;
}

/**
 * Student creation data (without generated fields)
 */
export interface CreateStudentData {
  studentCode?: string;
  // Personal information
  fullName: string;
  email?: string | null;
  phoneNumber?: string | null;
  address?: string | null;
  dateOfBirth?: Date | null;

  // Student-specific data
  nickname?: string | null;
  gender?: string | null;
}

/**
 * Student update data (partial)
 */
export interface UpdateStudentData {
  studentCode?: string;
  // Personal information
  fullName?: string;
  email?: string | null;
  phoneNumber?: string | null;
  address?: string | null;
  dateOfBirth?: Date | null;

  // Student-specific data
  nickname?: string | null;
  gender?: string | null;
}

/**
 * Student business rules and validation
 */
export class StudentEntity {
  /**
   * Valid gender values
   */
  static readonly VALID_GENDERS = ['MALE', 'FEMALE', 'OTHER'] as const;

  /**
   * Validate gender value
   */
  static validateGender(gender: string): boolean {
    return this.VALID_GENDERS.includes(gender as any);
  }

  /**
   * Update student profile
   */
  static updateProfile(student: Student, updates: UpdateStudentData): Student {
    return {
      ...student,
      ...updates,
      updatedAt: new Date(),
    };
  }

  /**
   * Validate nickname (if provided, must be 1-50 characters)
   */
  static validateNickname(nickname: string): boolean {
    if (!nickname) return true; // Nickname is optional
    return nickname.trim().length >= 1 && nickname.trim().length <= 50;
  }

  /**
   * Validate fullName (required, 2-100 characters)
   */
  static validateFullName(fullName: string): boolean {
    if (!fullName) return false;
    const trimmed = fullName.trim();
    return trimmed.length >= 2 && trimmed.length <= 100;
  }

  /**
   * Validate email format (optional, but must be valid if provided)
   */
  static validateEmail(email: string | null): boolean {
    if (!email) return true; // Email is optional for students
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate phone number format (optional, but must be valid if provided)
   * Supports Vietnamese phone format: +84xxxxxxxxx
   */
  static validatePhoneNumber(phoneNumber: string | null): boolean {
    if (!phoneNumber) return true; // Phone number is optional for students
    const phoneRegex = /^\+84\d{9,10}$/;
    return phoneRegex.test(phoneNumber);
  }

  /**
   * Check if student is archived (soft deleted)
   */
  static isArchived(student: Student): boolean {
    return student.isArchived;
  }

  /**
   * Archive student (soft delete)
   */
  static archive(student: Student): Student {
    return {
      ...student,
      isArchived: true,
      updatedAt: new Date(),
    };
  }

  /**
   * Restore student from archive
   */
  static restore(student: Student): Student {
    return {
      ...student,
      isArchived: false,
      updatedAt: new Date(),
    };
  }
}
