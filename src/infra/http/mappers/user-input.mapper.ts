import { CreateUserDto } from '../dtos/user-management/create-user.dto';
import { UpdateUserDto } from '../dtos/user-management/update-user.dto';
import { UserQueryDto } from '../dtos/user-management/user-query.dto';
import { CreateUserInput } from '../../../application/user-management/use-cases/user/create-user.use-case';
import { UpdateUserInput } from '../../../application/user-management/use-cases/user/update-user.use-case';
import { GetAllUsersInput } from '../../../application/user-management/use-cases/user/get-all-users.use-case';

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
export class UserInputMapper {
  /**
   * Maps CreateUserDto to CreateUserInput
   *
   * @param dto - DTO from HTTP request
   * @returns Input object expected by CreateUserUseCase
   */
  static toCreateInput(dto: CreateUserDto): CreateUserInput {
    return {
      email: dto.email,
      fullName: dto.fullName,
      phoneNumber: dto.phoneNumber || '',
      address: dto.address,
      dateOfBirth: dto.dateOfBirth,
      additionalInfo: dto.additionalInfo,
      isActive: dto.isActive ?? true, // Default to true if not provided
    };
  }

  /**
   * Maps UpdateUserDto to UpdateUserInput
   *
   * @param dto - DTO from HTTP request
   * @returns Input object expected by UpdateUserUseCase
   */
  static toUpdateInput(dto: UpdateUserDto): UpdateUserInput {
    return {
      email: dto.email,
      fullName: dto.fullName,
      phoneNumber: dto.phoneNumber,
      password: dto.password,
      address: dto.address,
      dateOfBirth: dto.dateOfBirth,
      isActive: dto.isActive,
    };
  }

  /**
   * Maps UserQueryDto to GetAllUsersInput
   *
   * Transforms StandardRequest pattern (offset, sort string) to
   * use case pattern (page, sortBy, order)
   *
   * @param dto - Query DTO from HTTP request
   * @returns Input object expected by GetAllUsersUseCase
   */
  static toGetAllInput(dto: UserQueryDto): GetAllUsersInput {
    // Calculate page from offset and limit
    const limit = dto.limit ?? 20;
    const offset = dto.offset ?? 0;
    const page = Math.floor(offset / limit) + 1;

    // Parse sort string format (e.g., "-createdAt,email" => sortBy: "createdAt", order: "desc")
    let sortBy = 'createdAt';
    let order: 'asc' | 'desc' = 'desc';
    if (dto.sort) {
      const firstSortField = dto.sort.split(',')[0];
      if (firstSortField.startsWith('-')) {
        sortBy = firstSortField.substring(1);
        order = 'desc';
      } else {
        sortBy = firstSortField;
        order = 'asc';
      }
    }

    // Parse filter JSON string to extract specific fields
    let filterData: Record<string, any> = {};
    if (dto.filter) {
      try {
        filterData = JSON.parse(dto.filter);
      } catch (error) {
        // Ignore invalid JSON
      }
    }

    return {
      page,
      limit,
      search: dto.email || dto.fullName || dto.phoneNumber, // Combine search fields
      ids: filterData.ids,
      isActive: filterData.isActive,
      roleIds: filterData.roleIds,
      sortBy,
      order,
    };
  }
}
