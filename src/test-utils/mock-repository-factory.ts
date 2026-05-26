/**
 * Mock Repository Factory
 * Provides factory functions to create mock repositories for testing
 */

import { CampusRepository } from "@/application/campus/ports/campus.repository";
import { StaffRepository } from "@/application/user-management/ports/staff.repository";
import { StudentRepository } from "@/application/user-management/ports/student.repository";
import { GuardianRepository } from "@/application/user-management/ports/guardian.repository";
import { UserRepository } from "@/application/user-management/ports/user.repository";
import { RoleRepository } from "@/application/user-management/ports/role.repository";
import { ClassRepository } from "@/application/class-management/ports/class.repository";
import { GradeLevelRepository } from "@/application/class-management/ports/grade-level.repository";
import { SchoolYearRepository } from "@/application/class-management/ports/school-year.repository";

/**
 * Create a mock CampusRepository
 */
export function createMockCampusRepository(): jest.Mocked<CampusRepository> {
  return {
    findById: jest.fn(),
    findByName: jest.fn(),
    findAll: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
  } as jest.Mocked<CampusRepository>;
}

/**
 * Create a mock StaffRepository
 */
export function createMockStaffRepository(): jest.Mocked<StaffRepository> {
  return {
    findById: jest.fn(),
    findByEmail: jest.fn(),
    findByEmailInCampus: jest.fn(),
    findByPhoneNumber: jest.fn(),
    findByPhoneNumberInCampus: jest.fn(),
    findByUserId: jest.fn(),
    findByStaffTypeId: jest.fn(),
    findByCampusId: jest.fn(),
    findByIds: jest.fn(),
    findAll: jest.fn(),
    findEligibleForClass: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  } as jest.Mocked<StaffRepository>;
}

/**
 * Create a mock StudentRepository
 */
export function createMockStudentRepository(): jest.Mocked<StudentRepository> {
  return {
    findById: jest.fn(),
    findByEmail: jest.fn(),
    findByEmailInCampus: jest.fn(),
    findByPhoneNumber: jest.fn(),
    findByPhoneNumberInCampus: jest.fn(),
    findByStudentCodeInCampus: jest.fn(),
    findByCampusId: jest.fn(),
    findByIds: jest.fn(),
    findAll: jest.fn(),
    findEligibleForClass: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    assignGuardians: jest.fn(),
    removeGuardians: jest.fn(),
    updateGuardianRelationship: jest.fn(),
    getStudentGuardians: jest.fn(),
  } as jest.Mocked<StudentRepository>;
}

/**
 * Create a mock GuardianRepository
 */
export function createMockGuardianRepository(): jest.Mocked<GuardianRepository> {
  return {
    findById: jest.fn(),
    findByEmail: jest.fn(),
    findByEmailInCampus: jest.fn(),
    findByPhoneNumber: jest.fn(),
    findByPhoneNumberInCampus: jest.fn(),
    findByUserId: jest.fn(),
    findByCampusId: jest.fn(),
    findByIds: jest.fn(),
    findAll: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    getGuardianChildren: jest.fn(),
  } as jest.Mocked<GuardianRepository>;
}

/**
 * Create a mock UserRepository
 */
export function createMockUserRepository(): jest.Mocked<UserRepository> {
  return {
    findById: jest.fn(),
    findByEmail: jest.fn(),
    findByClerkUid: jest.fn(),
    findAll: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    assignRoles: jest.fn(),
    removeRoles: jest.fn(),
    getUserRoles: jest.fn(),
    getUserRolesForCampus: jest.fn(),
  } as jest.Mocked<UserRepository>;
}

/**
 * Create a mock RoleRepository
 */
export function createMockRoleRepository(): jest.Mocked<RoleRepository> {
  return {
    findById: jest.fn(),
    findByName: jest.fn(),
    findByCampusId: jest.fn(),
    findSystemDefaults: jest.fn(),
    findAll: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
    assignPermissions: jest.fn(),
    removePermissions: jest.fn(),
    getPermissions: jest.fn(),
    getRoleUsers: jest.fn(),
  } as jest.Mocked<RoleRepository>;
}

/**
 * Create a mock ClassRepository
 */
export function createMockClassRepository(): jest.Mocked<ClassRepository> {
  return {
    findById: jest.fn(),
    findByNameInContextAndCampus: jest.fn(),
    findByCampusId: jest.fn(),
    findByGradeLevelId: jest.fn(),
    findBySchoolYearId: jest.fn(),
    findByIds: jest.fn(),
    findAll: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  } as jest.Mocked<ClassRepository>;
}

/**
 * Create a mock GradeLevelRepository
 */
export function createMockGradeLevelRepository(): jest.Mocked<GradeLevelRepository> {
  return {
    findById: jest.fn(),
    findByNameAndCampus: jest.fn(),
    findByOrderAndCampus: jest.fn(),
    findAll: jest.fn(),
    findNonArchived: jest.fn(),
    findAllPaginated: jest.fn(),
    findAllWithClasses: jest.fn(),
    findNonArchivedWithClasses: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    archive: jest.fn(),
    unarchive: jest.fn(),
    getMaxOrder: jest.fn(),
    reorder: jest.fn(),
  } as jest.Mocked<GradeLevelRepository>;
}

/**
 * Create a mock SchoolYearRepository
 */
export function createMockSchoolYearRepository(): jest.Mocked<SchoolYearRepository> {
  return {
    findById: jest.fn(),
    findByNameAndCampus: jest.fn(),
    findNonArchived: jest.fn(),
    findAll: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    archive: jest.fn(),
    unarchive: jest.fn(),
  } as jest.Mocked<SchoolYearRepository>;
}
