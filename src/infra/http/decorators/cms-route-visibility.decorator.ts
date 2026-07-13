import { SetMetadata } from "@nestjs/common";

export const CMS_ROUTE_VISIBILITY_KEY = "cmsRouteVisibility";

export enum CmsRouteVisibility {
  PUBLIC_READ = "PUBLIC_READ",
  STAFF_ONLY = "STAFF_ONLY",
}

/** Marks an authenticated CMS route as guardian-readable after campus/audience checks. */
export const CmsPublicRead = () =>
  SetMetadata(CMS_ROUTE_VISIBILITY_KEY, CmsRouteVisibility.PUBLIC_READ);

/** Overrides legacy post.read behavior for staff-only CMS routes. */
export const CmsStaffOnly = () =>
  SetMetadata(CMS_ROUTE_VISIBILITY_KEY, CmsRouteVisibility.STAFF_ONLY);
