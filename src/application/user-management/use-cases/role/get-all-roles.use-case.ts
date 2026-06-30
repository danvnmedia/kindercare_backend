import { Injectable, Inject, Logger } from "@nestjs/common";
import {
  FindAllRolesOptions,
  RoleRepository,
  PaginatedRoles,
} from "../../ports/role.repository";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";

@Injectable()
export class GetAllRolesUseCase {
  private readonly logger = new Logger(GetAllRolesUseCase.name);

  constructor(
    @Inject("ROLE_REPOSITORY")
    private readonly roleRepository: RoleRepository,
  ) {}

  async execute(
    params: StandardRequest,
    options: FindAllRolesOptions = {},
  ): Promise<PaginatedRoles> {
    try {
      this.logger.log(
        `Fetching roles: offset=${params.offset ?? 0}, limit=${params.limit ?? 10}`,
      );

      const result = await this.roleRepository.findAll(params, options);

      this.logger.log(
        `Found ${result.pagination.count} roles, returning page ${result.pagination.currentPage}`,
      );

      return result;
    } catch (error) {
      this.logger.error(`Failed to fetch roles: ${error.message}`, error.stack);
      throw error;
    }
  }
}
