import { RoleRepository } from "../../ports/role.repository";
import { RoleAssignmentInput } from "../../ports/user.repository";

export interface StaffTypeRoleGrantSource {
  defaultRoleId: string | null;
}

export async function buildStaffTypeRoleAssignments(
  roleRepository: RoleRepository,
  campusId: string,
  staffTypeIds: string[],
  resolvedTypes: Map<string, StaffTypeRoleGrantSource>,
): Promise<Array<RoleAssignmentInput & { grantedViaStaffTypeId: string }>> {
  const configuredAssignments = staffTypeIds.flatMap((typeId) => {
    const roleId = resolvedTypes.get(typeId)!.defaultRoleId;
    return roleId
      ? [
          {
            roleId,
            campusId,
            grantedViaStaffTypeId: typeId,
          },
        ]
      : [];
  });

  if (configuredAssignments.length > 0 || staffTypeIds.length === 0) {
    return configuredAssignments;
  }

  const fallbackRole = await roleRepository.ensureCampusAccessRole(campusId);
  return [
    {
      roleId: fallbackRole.id,
      campusId,
      grantedViaStaffTypeId: staffTypeIds[0],
    },
  ];
}
