/**
 * Campus Context Utilities
 * Provides helper functions for extracting and managing campus context in requests
 */

import { User } from "@/domain/user-management/user.entity";

export const CAMPUS_ID_HEADER = "x-campus-id";

/**
 * Extract campus ID from the request
 * Priority: header > route params > query params
 */
export function getCampusFromRequest(request: any): string | null {
  // Check header first (x-campus-id)
  const headerCampusId = request.headers?.[CAMPUS_ID_HEADER];
  if (headerCampusId && typeof headerCampusId === "string") {
    return headerCampusId;
  }

  // Check route params (:campusId)
  const paramCampusId = request.params?.campusId;
  if (paramCampusId && typeof paramCampusId === "string") {
    return paramCampusId;
  }

  // Check query params (?campusId=)
  const queryCampusId = request.query?.campusId;
  if (queryCampusId && typeof queryCampusId === "string") {
    return queryCampusId;
  }

  return null;
}

/**
 * Set campus ID on the request object for downstream use
 */
export function setCampusOnRequest(
  request: any,
  campusId: string | null,
): void {
  request.campusId = campusId;
}

/**
 * Get campus ID from request object (after validation by CampusGuard)
 */
export function getValidatedCampusId(request: any): string | null {
  return request.campusId ?? null;
}

/**
 * Check if user has access to a specific campus
 * User has access if they have at least one role assigned to that campus
 * OR if they have a global role (campusId = null)
 */
export function hasCampusAccess(user: User, campusId: string | null): boolean {
  if (!campusId) {
    // No specific campus required - allow access
    return true;
  }

  // Get roles for this campus (includes global roles)
  const applicableRoles = user.getRolesForCampus(campusId);
  return applicableRoles.length > 0;
}

/**
 * Check if user is a global admin (has a global role with admin permissions)
 * Global roles have campusId = null
 */
export function isGlobalAdmin(user: User): boolean {
  const globalRoles = user.getGlobalRoles();
  // Check if any global role has admin-level permissions
  return globalRoles.some(
    (role) =>
      role.name.toLowerCase().includes("admin") ||
      role.name.toLowerCase().includes("super"),
  );
}

/**
 * Validate UUID format
 */
export function isValidUUID(value: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}
