/**
 * Parent Domain Entity
 * Framework-agnostic pure TypeScript entity
 * NO NestJS decorators allowed in this layer
 */

/**
 * Parent entity - represents a parent/guardian profile
 * Personal information is now stored directly in Parent (denormalized)
 * Supports spouse relationship and optional User account
 */
export interface Parent {
  id: string;

  // Personal information (duplicated - no Person table)
  fullName: string;
  email: string;
  phoneNumber: string;
  address: string | null;
  dateOfBirth: Date | null;
  gender: string | null; // "MALE", "FEMALE", "OTHER"

  // Parent-specific data
  occupation: string | null;
  workAddress: string | null;

  // Spouse relationship
  spouseId: string | null;
  spouse?: Parent; // Optional eager-loaded spouse data

  // User authentication (optional - parent can be created before getting login)
  userId: string | null;

  // Soft delete
  isArchived: boolean;

  createdAt: Date;
  updatedAt: Date;
}

/**
 * Parent creation data (without generated fields)
 */
export interface CreateParentData {
  // Personal information
  fullName: string;
  email: string;
  phoneNumber: string;
  address?: string | null;
  dateOfBirth?: Date | null;
  gender?: string | null;

  // Parent-specific data
  occupation?: string | null;
  workAddress?: string | null;

  // Spouse relationship
  spouseId?: string | null;

  // User authentication
  userId?: string | null;
}

/**
 * Parent update data (partial)
 */
export interface UpdateParentData {
  // Personal information
  fullName?: string;
  email?: string;
  phoneNumber?: string;
  address?: string | null;
  dateOfBirth?: Date | null;
  gender?: string | null;

  // Parent-specific data
  occupation?: string | null;
  workAddress?: string | null;

  // Spouse relationship
  spouseId?: string | null;
}

/**
 * Parent with student relationship data
 */
export interface ParentRelationshipType {
  id: string; // "FATHER", "MOTHER", "GUARDIAN"
  name: string; // "Bố", "Mẹ", "Người giám hộ"
  description: string | null;
}

/**
 * Parent business rules and validation
 */
export class ParentEntity {
  /**
   * Validate that spouse is not the same as parent
   */
  static validateSpouse(parentId: string, spouseId: string): void {
    if (parentId === spouseId) {
      throw new Error("Parent cannot be spouse of themselves");
    }
  }

  /**
   * Check if parent has spouse
   */
  static hasSpouse(parent: Parent): boolean {
    return parent.spouseId !== null;
  }

  /**
   * Link spouse (create mutual relationship)
   * This should be handled at use case layer to ensure bidirectional link
   */
  static linkSpouse(parent: Parent, spouseId: string): Parent {
    this.validateSpouse(parent.id, spouseId);
    return {
      ...parent,
      spouseId,
      updatedAt: new Date(),
    };
  }

  /**
   * Unlink spouse
   */
  static unlinkSpouse(parent: Parent): Parent {
    return {
      ...parent,
      spouseId: null,
      updatedAt: new Date(),
    };
  }

  /**
   * Check if two parents are spouses
   */
  static areSpouses(parent1: Parent, parent2: Parent): boolean {
    return (
      (parent1.spouseId === parent2.id && parent2.spouseId === parent1.id) ||
      parent1.spouseId === parent2.id ||
      parent2.spouseId === parent1.id
    );
  }

  /**
   * Get parent type based on relationship
   * FATHER → Father, MOTHER → Mother, GUARDIAN → Guardian
   */
  static getParentType(relationshipId: string): string {
    const types: Record<string, string> = {
      FATHER: "Father",
      MOTHER: "Mother",
      GUARDIAN: "Guardian",
    };
    return types[relationshipId] || "Guardian";
  }

  /**
   * Validate parent relationship ID
   */
  static validateRelationshipId(relationshipId: string): boolean {
    const validRelationships = ["FATHER", "MOTHER", "GUARDIAN"];
    return validRelationships.includes(relationshipId);
  }

  /**
   * Update parent profile
   */
  static updateProfile(parent: Parent, updates: UpdateParentData): Parent {
    // Validate spouse if provided
    if (updates.spouseId) {
      this.validateSpouse(parent.id, updates.spouseId);
    }

    return {
      ...parent,
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
   * Validate email format (required for parents)
   */
  static validateEmail(email: string): boolean {
    if (!email) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate phone number format (required for parents)
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
   * Check if parent is archived (soft deleted)
   */
  static isArchived(parent: Parent): boolean {
    return parent.isArchived;
  }

  /**
   * Archive parent (soft delete)
   */
  static archive(parent: Parent): Parent {
    return {
      ...parent,
      isArchived: true,
      updatedAt: new Date(),
    };
  }

  /**
   * Restore parent from archive
   */
  static restore(parent: Parent): Parent {
    return {
      ...parent,
      isArchived: false,
      updatedAt: new Date(),
    };
  }

  /**
   * Check if parent has user account
   */
  static hasUserAccount(parent: Parent): boolean {
    return parent.userId !== null;
  }
}
