import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import {
  PaginatedRoleMembers,
  RoleRepository,
} from "../../ports/role.repository";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";

export interface GetRoleMembersInput {
  roleId: string;
  campusId: string;
  params: StandardRequest;
}

@Injectable()
export class GetRoleMembersUseCase {
  constructor(
    @Inject("ROLE_REPOSITORY")
    private readonly roleRepository: RoleRepository,
  ) {}

  async execute(input: GetRoleMembersInput): Promise<PaginatedRoleMembers> {
    const role = await this.roleRepository.findById(input.roleId);
    if (!role) {
      throw new NotFoundException(`Role with ID ${input.roleId} not found`);
    }

    if (role.campusId === null) {
      throw new BadRequestException(
        "Global roles do not have campus-scoped member management",
      );
    }
    if (role.campusId !== input.campusId) {
      throw new BadRequestException(
        `Role belongs to campus ${role.campusId}, not ${input.campusId}`,
      );
    }

    return this.roleRepository.getRoleMembers(
      input.roleId,
      input.campusId,
      input.params,
    );
  }
}
