import { ForbiddenException } from "@nestjs/common";

import { User } from "@/domain/user-management/user.entity";

export const GLOBAL_IDENTITY_AUDIT_CAMPUS_ID =
  "00000000-0000-4000-8000-000000000000";

export function isGlobalIdentityAdmin(user: User): boolean {
  return user.getGlobalRoles().some((role) => role.isSystemRole === true);
}

export function assertGlobalIdentityAdmin(user: User): void {
  if (isGlobalIdentityAdmin(user)) {
    return;
  }

  throw new ForbiddenException("Global super admin role required");
}

export function getActorName(user: User): string | null {
  return user.profile?.fullName ?? null;
}
