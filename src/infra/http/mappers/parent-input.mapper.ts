import { CreateParentRequest } from '../dtos/user-management/parent';
import { CreateParentInput } from '@/application/user-management/use-cases/parent/create-parent.use-case';

/**
 * Mapper to transform HTTP DTOs to Application Layer Use Case Inputs
 *
 * This mapper follows Clean Architecture principles by decoupling
 * the presentation layer (DTOs) from the application layer (use case inputs).
 */
export class ParentInputMapper {
  /**
   * Maps CreateParentRequest to CreateParentInput
   *
   * @param dto - DTO from HTTP request
   * @returns Input object expected by CreateParentUseCase
   */
  static toCreateInput(dto: CreateParentRequest): CreateParentInput {
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
