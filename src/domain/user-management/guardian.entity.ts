/**
 * Guardian Domain Entity
 * Framework-agnostic pure TypeScript entity
 * NO NestJS decorators allowed in this layer
 */

import { Student } from './student.entity';

/**
 * Guardian entity - represents a parent/guardian profile
 * Personal information is now stored directly in Guardian (denormalized)
 * Supports spouse relationship and optional User account
 */
export interface Guardian {
  id: string;

  // Personal information (duplicated - no Person table)
  fullName: string;
  email: string;
  phoneNumber: string;
  address: string | null;
  dateOfBirth: Date | null;
  gender: string | null; // "MALE", "FEMALE", "OTHER"

  // Guardian-specific data
  occupation: string | null;
  workAddress: string | null;

  // Spouse relationship
  spouseId: string | null;
  spouse?: Guardian; // Optional eager-loaded spouse data

  // User authentication (optional - guardian can be created before getting login)
  userId: string | null;

  // Soft delete
  isArchived: boolean;

  children?: GuardianStudent[];

  createdAt: Date;
  updatedAt: Date;
}


export interface GuardianRelationship {
  id: string;
  name: string;
}

export interface GuardianStudent {
  student: Student;
  guardianRelationship: GuardianRelationship;
}

/**
 * Guardian creation data (without generated fields)
 */
export interface CreateGuardianData {
  // Personal information
  fullName: string;
  email: string;
  phoneNumber: string;
  address?: string | null;
  dateOfBirth?: Date | null;
  gender?: string | null;

  // Guardian-specific data
  occupation?: string | null;
  workAddress?: string | null;

  // Spouse relationship
  spouseId?: string | null;

  // User authentication
  userId?: string | null;
}

/**
 * Guardian update data (partial)
 */
export interface UpdateGuardianData {
  // Personal information
  fullName?: string;
  email?: string;
  phoneNumber?: string;
  address?: string | null;
  dateOfBirth?: Date | null;
  gender?: string | null;

  // Guardian-specific data
  occupation?: string | null;
  workAddress?: string | null;

  // Spouse relationship
  spouseId?: string | null;
}

/**
 * Guardian with student relationship data
 */
export interface GuardianRelationshipType {
  id: string; // "FATHER", "MOTHER", "GUARDIAN"
  name: string; // "Bố", "Mẹ", "Người giám hộ"
  description: string | null;
}

/**
 * Guardian business rules and validation
 */
export class GuardianEntity {
  /**
   * Validate that spouse is not the same as guardian
   */
  static validateSpouse(guardianId: string, spouseId: string): void {
    if (guardianId === spouseId) {
      throw new Error('Guardian cannot be spouse of themselves');
    }
  }

  /**
   * Check if guardian has spouse
   */
  static hasSpouse(guardian: Guardian): boolean {
    return guardian.spouseId !== null;
  }

  /**
   * Link spouse (create mutual relationship)
   * This should be handled at use case layer to ensure bidirectional link
   */
  static linkSpouse(guardian: Guardian, spouseId: string): Guardian {
    this.validateSpouse(guardian.id, spouseId);
    return {
      ...guardian,
      spouseId,
      updatedAt: new Date(),
    };
  }

  /**
   * Unlink spouse
   */
  static unlinkSpouse(guardian: Guardian): Guardian {
    return {
      ...guardian,
      spouseId: null,
      updatedAt: new Date(),
    };
  }

  /**
   * Check if two guardians are spouses
   */
  static areSpouses(guardian1: Guardian, guardian2: Guardian): boolean {
    return (
      (guardian1.spouseId === guardian2.id && guardian2.spouseId === guardian1.id) ||
      (guardian1.spouseId === guardian2.id || guardian2.spouseId === guardian1.id)
    );
  }

  /**
   * Get guardian type based on relationship
   * FATHER → Father, MOTHER → Mother, GUARDIAN → Guardian
   */
  static getGuardianType(relationshipId: string): string {
    const types: Record<string, string> = {
      FATHER: 'Father',
      MOTHER: 'Mother',
      GUARDIAN: 'Guardian',
    };
    return types[relationshipId] || 'Guardian';
  }

  /**
   * Validate guardian relationship ID
   */
  static validateRelationshipId(relationshipId: string): boolean {
    const validRelationships = ['FATHER', 'MOTHER', 'GUARDIAN'];
    return validRelationships.includes(relationshipId);
  }

  /**
   * Update guardian profile
   */
  static updateProfile(guardian: Guardian, updates: UpdateGuardianData): Guardian {
    // Validate spouse if provided
    if (updates.spouseId) {
      this.validateSpouse(guardian.id, updates.spouseId);
    }

    return {
      ...guardian,
      ...updates,
      updatedAt: new Date(),
    };
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
   * Validate email format (required for guardians)
   */
  static validateEmail(email: string): boolean {
    if (!email) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate phone number format (required for guardians)
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
  static readonly VALID_GENDERS = ['MALE', 'FEMALE', 'OTHER'] as const;

  static validateGender(gender: string): boolean {
    return this.VALID_GENDERS.includes(gender as any);
  }

  /**
   * Check if guardian is archived (soft deleted)
   */
  static isArchived(guardian: Guardian): boolean {
    return guardian.isArchived;
  }

  /**
   * Archive guardian (soft delete)
   */
  static archive(guardian: Guardian): Guardian {
    return {
      ...guardian,
      isArchived: true,
      updatedAt: new Date(),
    };
  }

  /**
   * Restore guardian from archive
   */
  static restore(guardian: Guardian): Guardian {
    return {
      ...guardian,
      isArchived: false,
      updatedAt: new Date(),
    };
  }

  /**
   * Check if guardian has user account
   */
  static hasUserAccount(guardian: Guardian): boolean {
    return guardian.userId !== null;
  }
}
