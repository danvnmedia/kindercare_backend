import { StaffType } from "@/domain/user-management/entities/staff-type.entity";
import { User } from "@/domain/user-management/user.entity";

export interface StaffTypeAuditSnapshot {
  name: string;
  description: string | null;
  campusId: string;
  defaultRoleId: string | null;
  isArchived: boolean;
  order: number;
  [key: string]: unknown;
}

export interface StaffTypeOrderAuditSnapshot {
  ids: string[];
  items: Array<{ id: string; name: string; order: number }>;
  [key: string]: unknown;
}

export interface StaffTypeAuditContext {
  staffTypeId: string;
  staffTypeName: string;
  campusId: string;
  actorName: string | null;
  targetName: string;
  [key: string]: unknown;
}

export interface StaffTypesReorderAuditContext {
  campusId: string;
  staffTypeIds: string[];
  actorName: string | null;
  targetName: string;
  [key: string]: unknown;
}

export function pickStaffTypeAuditFields(
  staffType: StaffType,
): StaffTypeAuditSnapshot {
  return {
    name: staffType.name,
    description: staffType.description,
    campusId: staffType.campusId,
    defaultRoleId: staffType.defaultRoleId,
    isArchived: staffType.isArchived,
    order: staffType.order,
  };
}

export function pickStaffTypeOrderAuditFields(
  staffTypes: StaffType[],
): StaffTypeOrderAuditSnapshot {
  const ordered = [...staffTypes].sort(
    (left, right) => left.order - right.order,
  );

  return {
    ids: ordered.map((staffType) => staffType.id),
    items: ordered.map((staffType) => ({
      id: staffType.id,
      name: staffType.name,
      order: staffType.order,
    })),
  };
}

export function buildStaffTypeAuditContext(
  staffType: Pick<StaffType, "id" | "name">,
  campusId: string,
  actor: User,
): StaffTypeAuditContext {
  return {
    staffTypeId: staffType.id,
    staffTypeName: staffType.name,
    campusId,
    actorName: actor.profile?.fullName ?? null,
    targetName: staffType.name,
  };
}

export function buildStaffTypesReorderAuditContext(
  campusId: string,
  staffTypeIds: string[],
  actor: User,
): StaffTypesReorderAuditContext {
  return {
    campusId,
    staffTypeIds,
    actorName: actor.profile?.fullName ?? null,
    targetName: "StaffType order",
  };
}
