import { Injectable, Inject, Logger } from "@nestjs/common";
import { Campus } from "@/domain/campus/entities/campus.entity";
import { CampusRepository } from "../ports/campus.repository";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";

/**
 * Input for GetAllCampusesUseCase with campus access control
 */
export interface GetAllCampusesInput {
  /**
   * Campus IDs the user has access to:
   * - null: User has global access, return all campuses
   * - []: User has no role assignments, return empty result
   * - [...ids]: User has access to specific campuses, filter by these IDs
   */
  accessibleCampusIds: string[] | null;
  params: StandardRequest;
}

@Injectable()
export class GetAllCampusesUseCase {
  private readonly logger = new Logger(GetAllCampusesUseCase.name);

  constructor(
    @Inject("CAMPUS_REPOSITORY")
    private readonly campusRepository: CampusRepository,
  ) {}

  async execute(input: GetAllCampusesInput): Promise<PaginatedResult<Campus>> {
    const { accessibleCampusIds, params } = input;

    // Case 1: User has global access - return all campuses
    if (accessibleCampusIds === null) {
      this.logger.log("Getting all campuses (global access)");
      return await this.campusRepository.findAll(params);
    }

    // Case 2: User has no role assignments - return empty result
    if (accessibleCampusIds.length === 0) {
      this.logger.log("Returning empty result (no campus access)");
      const limit = params.limit ?? 10;
      return {
        data: [],
        pagination: {
          count: 0,
          limit,
          offset: params.offset ?? 0,
          totalPages: 0,
          currentPage: 1,
          hasNext: false,
          hasPrev: false,
        },
      };
    }

    // Case 3: User has access to specific campuses - filter by IDs
    this.logger.log(
      `Getting campuses for user with access to ${accessibleCampusIds.length} campus(es)`,
    );

    // Parse existing filter string if present
    let existingFilter: Record<string, unknown> = {};
    if (params.filter) {
      try {
        existingFilter = JSON.parse(params.filter);
      } catch {
        this.logger.warn(`Invalid filter JSON: ${params.filter}`);
      }
    }

    // Inject campus ID filter to ensure access scoping
    const scopedFilter = {
      ...existingFilter,
      id: { in: accessibleCampusIds },
    };

    const scopedParams: StandardRequest = {
      ...params,
      filter: JSON.stringify(scopedFilter),
    };

    return await this.campusRepository.findAll(scopedParams);
  }
}
