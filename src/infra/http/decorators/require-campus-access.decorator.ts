/**
 * Require Campus Access Decorator
 * Method/Class decorator that applies CampusGuard with configuration options
 */

import { applyDecorators, SetMetadata } from "@nestjs/common";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { CampusGuard } from "../guards/campus.guard";

export const REQUIRE_CAMPUS_ACCESS_KEY = "requireCampusAccess";

/**
 * Options for the RequireCampusAccess decorator
 */
export interface RequireCampusAccessOptions {
  /**
   * Whether campus context is required (throw 400 if missing)
   * @default true
   */
  required?: boolean;

  /**
   * Whether the campus must be active
   * @default true
   */
  requireActive?: boolean;

  /**
   * Whether to check if user has access to the campus
   * Set to false for public campus endpoints
   * @default true
   */
  checkUserAccess?: boolean;

  /**
   * Whether global admins can access any campus
   * @default true
   */
  allowGlobalAdmin?: boolean;
}

function UseCampusGuardFirst(): MethodDecorator & ClassDecorator {
  return (
    target: object,
    _propertyKey?: string | symbol,
    descriptor?: PropertyDescriptor,
  ): void => {
    const metadataTarget = descriptor?.value ?? target;
    const previousGuards =
      Reflect.getMetadata(GUARDS_METADATA, metadataTarget) ?? [];
    const guards = [
      CampusGuard,
      ...previousGuards.filter((guard: unknown) => guard !== CampusGuard),
    ];

    Reflect.defineMetadata(GUARDS_METADATA, guards, metadataTarget);
  };
}

/**
 * Decorator that requires campus context for the route.
 * Applies CampusGuard with the specified options.
 *
 * @example Basic usage (all validations enabled)
 * ```typescript
 * @Controller('students')
 * @RequireCampusAccess()
 * export class StudentController {
 *   // All routes require campus context
 * }
 * ```
 *
 * @example Optional campus context
 * ```typescript
 * @Get('reports')
 * @RequireCampusAccess({ required: false })
 * async getReports(@CampusContext() campusId: string | null) {
 *   // campusId may be null
 * }
 * ```
 *
 * @example Public campus endpoint (no user access check)
 * ```typescript
 * @Get('info')
 * @RequireCampusAccess({ checkUserAccess: false })
 * async getCampusInfo(@CampusContext() campusId: string) {
 *   // Anyone can access campus info
 * }
 * ```
 *
 * @example Allow access to inactive campuses (for admin management)
 * ```typescript
 * @Patch(':id/activate')
 * @RequireCampusAccess({ requireActive: false })
 * async activateCampus(@CampusContext() campusId: string) {
 *   // Can access even if campus is inactive
 * }
 * ```
 */
export function RequireCampusAccess(
  options: RequireCampusAccessOptions = {},
): MethodDecorator & ClassDecorator {
  return applyDecorators(
    SetMetadata(REQUIRE_CAMPUS_ACCESS_KEY, options),
    UseCampusGuardFirst(),
  );
}

/**
 * Alias for RequireCampusAccess with required: false
 * Use this when campus context is optional
 */
export function OptionalCampusAccess(
  options: Omit<RequireCampusAccessOptions, "required"> = {},
): MethodDecorator & ClassDecorator {
  return RequireCampusAccess({ ...options, required: false });
}
