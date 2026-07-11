import { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { User, UserProfile } from "@/domain/user-management/user.entity";
import {
  CMS_ROUTE_VISIBILITY_KEY,
  CmsRouteVisibility,
} from "../decorators/cms-route-visibility.decorator";

export function getCmsRouteVisibility(
  reflector: Reflector,
  context: ExecutionContext,
): CmsRouteVisibility | undefined {
  const visibility = reflector.getAllAndOverride<CmsRouteVisibility>(
    CMS_ROUTE_VISIBILITY_KEY,
    [context.getHandler(), context.getClass()],
  );

  return visibility === CmsRouteVisibility.PUBLIC_READ ||
    visibility === CmsRouteVisibility.STAFF_ONLY
    ? visibility
    : undefined;
}

export function getActiveGuardianProfileForCampus(
  user: User,
  campusId: string | null,
): UserProfile | undefined {
  if (!campusId) return undefined;

  return user.profiles.find(
    (profile) => profile.type === "guardian" && profile.campusId === campusId,
  );
}

export function canGuardianReadCmsRoute(
  reflector: Reflector,
  context: ExecutionContext,
  user: User,
  campusId: string | null,
): boolean {
  if (
    getCmsRouteVisibility(reflector, context) !==
      CmsRouteVisibility.PUBLIC_READ ||
    getActiveGuardianProfileForCampus(user, campusId) === undefined
  ) {
    return false;
  }

  const hasStaffProfileInCampus = user.profiles.some(
    (profile) => profile.type === "staff" && profile.campusId === campusId,
  );

  return !hasStaffProfileInCampus;
}
