import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";

import { ClassStaff } from "@/domain/class-management/entities/class-staff.entity";
import { ClassStaffRole } from "@/domain/class-management/enums/class-staff-role.enum";
import { User } from "@/domain/user-management/user.entity";
import { UnitOfWorkPort } from "@/application/ports/unit-of-work.port";
import { StaffRepository } from "@/application/user-management/ports/staff.repository";

import { ClassStaffRepository } from "../../ports/class-staff.repository";
import { ClassRepository } from "../../ports/class.repository";
import { ClassStaffErrorCode } from "../../class-staff-error-codes";

const MAX_BATCH_SIZE = 100;

export interface BulkAssignStaffItem {
  staffId: string;
  role: ClassStaffRole;
}

export interface BulkAssignStaffToClassInput {
  campusId: string;
  classId: string;
  staff: BulkAssignStaffItem[];
}

export interface BulkAssignSkippedItem {
  staffId: string;
  reason: string;
  message?: string;
}

export interface BulkAssignStaffToClassResult {
  assigned: ClassStaff[];
  skipped: BulkAssignSkippedItem[];
}

/**
 * Bulk-assign staff to a class in a single call.
 *
 * Specs:
 *   - @doc/specs/bulk-class-staff-assignment (FR-1..FR-5, D1..D10).
 *   - @doc/specs/admin-audit-log (D4 — same-tx audit + mutation atomicity).
 *
 * Two-stage validation:
 *   - Whole-call: short-circuits 4xx with zero row work on first failure.
 *   - Per-row: tolerant — first failure pushes to `skipped[]` and continues.
 *
 * Survivors persist inside ONE `unitOfWork.run` (D3, D10): each survivor row
 * emits one `tx.createClassStaff` + one `tx.recordAudit`
 * (`ASSIGN_STAFF_TO_CLASS`) atomically. A mid-batch DB error rolls back the
 * entire batch (Scenario 6).
 */
@Injectable()
export class BulkAssignStaffToClassUseCase {
  private readonly logger = new Logger(BulkAssignStaffToClassUseCase.name);

  constructor(
    @Inject("CLASS_STAFF_REPOSITORY")
    private readonly classStaffRepository: ClassStaffRepository,
    @Inject("CLASS_REPOSITORY")
    private readonly classRepository: ClassRepository,
    @Inject("STAFF_REPOSITORY")
    private readonly staffRepository: StaffRepository,
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(
    input: BulkAssignStaffToClassInput,
    currentUser: User,
  ): Promise<BulkAssignStaffToClassResult> {
    this.logger.log(
      `Bulk assign staff: classId=${input.classId} campusId=${input.campusId} count=${input.staff.length}`,
    );

    // ---- Whole-call validation (FR-3) — short-circuits in this exact order. ----
    if (input.staff.length === 0) {
      throw new BadRequestException(ClassStaffErrorCode.BATCH_EMPTY);
    }
    if (input.staff.length > MAX_BATCH_SIZE) {
      throw new BadRequestException(ClassStaffErrorCode.BATCH_TOO_LARGE);
    }
    const seen = new Set<string>();
    for (const row of input.staff) {
      if (seen.has(row.staffId)) {
        throw new BadRequestException(
          ClassStaffErrorCode.DUPLICATE_STAFF_IN_BATCH,
        );
      }
      seen.add(row.staffId);
    }
    const homeroomCount = input.staff.reduce(
      (n, row) => n + (row.role === ClassStaffRole.HOMEROOM ? 1 : 0),
      0,
    );
    if (homeroomCount > 1) {
      throw new BadRequestException(
        ClassStaffErrorCode.MULTIPLE_HOMEROOM_IN_BATCH,
      );
    }

    // Class existence + cross-campus → 404 with the same body (D9 — existence
    // hidden across the campus boundary).
    const classEntity = await this.classRepository.findById(input.classId);
    if (!classEntity || classEntity.campusId !== input.campusId) {
      throw new NotFoundException(`Class with ID ${input.classId} not found`);
    }

    // D2 caps role=HOMEROOM rows at 1 per batch, so a single pre-loop lookup
    // covers every per-row HOMEROOM_ALREADY_ASSIGNED check (NFR-2 vs. issuing
    // it inside the row loop).
    const existingHomeroom =
      homeroomCount === 1
        ? await this.classStaffRepository.findHomeroomByClassId(input.classId)
        : null;

    // ---- Per-row validation (FR-4) — first failure pushes to skipped[]. ----
    const skipped: BulkAssignSkippedItem[] = [];
    const toCreate: ClassStaff[] = [];

    for (const row of input.staff) {
      const staff = await this.staffRepository.findById(row.staffId);
      if (!staff) {
        skipped.push({
          staffId: row.staffId,
          reason: ClassStaffErrorCode.STAFF_NOT_FOUND,
        });
        continue;
      }
      if (staff.campusId !== input.campusId) {
        skipped.push({
          staffId: row.staffId,
          reason: ClassStaffErrorCode.STAFF_NOT_IN_CAMPUS,
        });
        continue;
      }
      const existing = await this.classStaffRepository.findByPair(
        input.classId,
        row.staffId,
      );
      if (existing) {
        skipped.push({
          staffId: row.staffId,
          reason: ClassStaffErrorCode.STAFF_ALREADY_ASSIGNED,
        });
        continue;
      }
      if (row.role === ClassStaffRole.HOMEROOM && existingHomeroom) {
        skipped.push({
          staffId: row.staffId,
          reason: ClassStaffErrorCode.HOMEROOM_ALREADY_ASSIGNED,
        });
        continue;
      }

      toCreate.push(
        ClassStaff.create({
          classId: input.classId,
          staffId: row.staffId,
          role: row.role,
        }),
      );
    }

    // ---- Persist survivors atomically (FR-5, D3, D10). ----
    if (toCreate.length === 0) {
      this.logger.log(
        `Bulk assign staff done: classId=${input.classId} assigned=0 skipped=${skipped.length}`,
      );
      return { assigned: [], skipped };
    }

    const actorName = currentUser.profile?.fullName ?? null;
    const assigned = await this.unitOfWork.run(async (tx) => {
      const persisted: ClassStaff[] = [];
      for (const entity of toCreate) {
        await tx.createClassStaff({
          classId: entity.classId,
          staffId: entity.staffId,
          role: entity.role,
          createdAt: entity.createdAt,
          updatedAt: entity.updatedAt,
        });
        await tx.recordAudit({
          actorId: currentUser.id,
          action: "ASSIGN_STAFF_TO_CLASS",
          targetType: "staff",
          targetId: entity.staffId,
          campusId: input.campusId,
          context: {
            actorName,
            classId: entity.classId,
            role: entity.role,
          },
        });
        persisted.push(entity);
      }
      return persisted;
    });

    this.logger.log(
      `Bulk assign staff done: classId=${input.classId} assigned=${assigned.length} skipped=${skipped.length}`,
    );

    return { assigned, skipped };
  }
}
