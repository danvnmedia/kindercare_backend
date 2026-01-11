/**
 * Campus Context Decorator
 * Parameter decorator to extract campus ID from the request
 */

import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import {
  getCampusFromRequest,
  getValidatedCampusId,
} from "../context/campus-context";

/**
 * Parameter decorator to extract the campus ID from the request.
 *
 * If used after CampusGuard has run, returns the validated campus ID
 * stored on the request object. Otherwise, extracts from header/params/query.
 *
 * @example
 * ```typescript
 * @Get('students')
 * @UseGuards(CampusGuard)
 * async getStudents(@CampusContext() campusId: string) {
 *   return this.studentService.findByCampus(campusId);
 * }
 * ```
 *
 * @example With optional campus
 * ```typescript
 * @Get('reports')
 * async getReports(@CampusContext() campusId: string | null) {
 *   if (campusId) {
 *     return this.reportService.findByCampus(campusId);
 *   }
 *   return this.reportService.findAll();
 * }
 * ```
 */
export const CampusContext = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string | null => {
    const request = ctx.switchToHttp().getRequest();

    // First, try to get the validated campus ID (set by CampusGuard)
    const validatedCampusId = getValidatedCampusId(request);
    if (validatedCampusId !== null) {
      return validatedCampusId;
    }

    // Fallback: extract directly from request
    return getCampusFromRequest(request);
  },
);

/**
 * Re-export the header constant for consumers
 */
export { CAMPUS_ID_HEADER } from "../context/campus-context";
