import { CreateGuardianRequest } from '../dtos/user-management/guardian';
import { CreateGuardianInput } from '@/application/user-management/use-cases/guardian/create-guardian.use-case';

/**
 * Mapper to transform HTTP DTOs to Application Layer Use Case Inputs
 *
 * This mapper follows Clean Architecture principles by decoupling
 * the presentation layer (DTOs) from the application layer (use case inputs).
 */
export class GuardianInputMapper {
  /**
   * Maps CreateGuardianRequest to CreateGuardianInput
   *
   * @param dto - DTO from HTTP request
   * @returns Input object expected by CreateGuardianUseCase
   */
  static toCreateInput(dto: CreateGuardianRequest): CreateGuardianInput {
    return {
      fullName: dto.fullName,
      dateOfBirth: dto.dateOfBirth,
      gender: dto.gender,
      phoneNumber: dto.phoneNumber,
      email: dto.email,
      address: dto.address,
    };
  }
}
