import { BadRequestException, NotFoundException } from "@nestjs/common";

import { Role } from "@/domain/user-management/role.entity";

import { RoleRepository } from "../../ports/role.repository";

export async function loadAllowedDefaultRole(
  roleRepository: RoleRepository,
  roleId: string,
  campusId: string,
): Promise<Role> {
  const role = await roleRepository.findById(roleId);
  if (!role) {
    throw new NotFoundException(`Role with ID "${roleId}" not found`);
  }

  if (role.campusId !== campusId || role.isSystemRole || role.isSystemDefault) {
    throw new BadRequestException(
      "Default role must be a mutable role in the same campus",
    );
  }

  return role;
}
