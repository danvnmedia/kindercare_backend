import { CreateStudentRequest } from '../dtos/user-management/student';
import { CreateStudentInput } from '@/application/user-management/use-cases/student/create-student.use-case';

/**
 * Mapper to transform HTTP DTOs to Application Layer Use Case Inputs
 *
 * This mapper follows Clean Architecture principles by decoupling
 * the presentation layer (DTOs) from the application layer (use case inputs).
 *
 * Benefits:
 * - Explicit data transformation
 * - No implicit coupling between layers
 * - Easy to handle default values and missing properties
 * - Testable pure functions
 */
export class StudentInputMapper {
  /**
   * Maps CreateStudentRequest to CreateStudentInput
   *
   * @param dto - DTO from HTTP request
   * @returns Input object expected by CreateStudentUseCase
   */
  static toCreateInput(dto: CreateStudentRequest): CreateStudentInput {
    return {
      // Person information
      fullName: dto.fullName,
      nickname: dto.nickname,
      dateOfBirth: dto.dateOfBirth,
      gender: dto.gender,
      phoneNumber: dto.phoneNumber,
      email: dto.email,
      address: dto.address,

      // Student information
      createUserAccount: dto.createUserAccount ?? false, // Default to false
      enrollmentDate: dto.enrollmentDate,
      classId: dto.classId,
      isOnTrack: dto.isOnTrack ?? true, // Default to true

      // Parent assignment
      parentIds: dto.parentIds,
    };
  }
}
