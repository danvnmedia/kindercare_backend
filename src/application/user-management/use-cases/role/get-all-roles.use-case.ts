import { Injectable, Inject } from '@nestjs/common';
import { RoleRepository, FindAllRolesParams, PaginatedRoles } from '../../ports/role.repository';

export interface GetAllRolesInput {
  page?: number;
  limit?: number;
  search?: string;
  ids?: string[];
  sortBy?: string;
  order?: 'asc' | 'desc';
}

@Injectable()
export class GetAllRolesUseCase {
  constructor(
    @Inject('ROLE_REPOSITORY')
    private readonly roleRepository: RoleRepository,
  ) {}

  async execute(input: GetAllRolesInput): Promise<PaginatedRoles> {
    const params: FindAllRolesParams = {
      page: input.page ?? 1,
      limit: input.limit ?? 20,
      search: input.search,
      ids: input.ids,
      sortBy: input.sortBy ?? 'createdAt',
      order: input.order ?? 'desc',
    };

    return await this.roleRepository.findAll(params);
  }
}
