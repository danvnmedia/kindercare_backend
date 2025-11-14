import { Injectable, Inject } from '@nestjs/common';
import { UserRepository, FindAllUsersParams, PaginatedUsers } from '../../ports/user.repository';

export interface GetAllUsersInput {
  page?: number;
  limit?: number;
  search?: string;
  ids?: string[];
  isActive?: boolean;
  roleIds?: string[];
  sortBy?: string;
  order?: 'asc' | 'desc';
}

@Injectable()
export class GetAllUsersUseCase {
  constructor(
    @Inject('USER_REPOSITORY')
    private readonly userRepository: UserRepository,
  ) {}

  async execute(input: GetAllUsersInput): Promise<PaginatedUsers> {
    const params: FindAllUsersParams = {
      page: input.page ?? 1,
      limit: input.limit ?? 20,
      search: input.search,
      ids: input.ids,
      isActive: input.isActive,
      roleIds: input.roleIds,
      sortBy: input.sortBy ?? 'createdAt',
      order: input.order ?? 'desc',
    };

    return await this.userRepository.findAll(params);
  }
}
