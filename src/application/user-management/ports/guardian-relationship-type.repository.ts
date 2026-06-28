import { GuardianRelationshipType } from "@/domain/user-management/entities/guardian-relationship-type.entity";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";

export abstract class GuardianRelationshipTypeRepository {
  abstract findById(id: string): Promise<GuardianRelationshipType | null>;

  abstract findByName(
    campusId: string,
    name: string,
  ): Promise<GuardianRelationshipType | null>;

  abstract findByOrderAndCampus(
    order: number,
    campusId: string,
  ): Promise<GuardianRelationshipType | null>;

  abstract findByCampusId(
    campusId: string,
  ): Promise<GuardianRelationshipType[]>;

  abstract findAll(
    params: StandardRequest,
    scope?: Record<string, any>,
  ): Promise<PaginatedResult<GuardianRelationshipType>>;

  abstract save(
    type: GuardianRelationshipType,
  ): Promise<GuardianRelationshipType>;

  abstract update(
    type: GuardianRelationshipType,
  ): Promise<GuardianRelationshipType>;

  abstract delete(id: string): Promise<void>;

  abstract exists(id: string): Promise<boolean>;

  abstract existsAndNotArchived(id: string): Promise<boolean>;

  abstract getMaxOrder(campusId: string): Promise<number>;

  /**
   * Reorder guardian relationship types within a campus.
   * Uses two-phase transaction to avoid unique constraint violations.
   */
  abstract reorder(
    campusId: string,
    ids: string[],
  ): Promise<GuardianRelationshipType[]>;
}
