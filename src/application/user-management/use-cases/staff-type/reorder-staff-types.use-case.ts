import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
  Logger,
} from "@nestjs/common";
import { UnitOfWorkPort } from "@/application/ports/unit-of-work.port";
import { StaffType } from "@/domain/user-management/entities/staff-type.entity";
import { User } from "@/domain/user-management/user.entity";
import { StaffTypeRepository } from "../../ports/staff-type.repository";
import {
  buildStaffTypesReorderAuditContext,
  pickStaffTypeOrderAuditFields,
} from "./staff-type-audit";

export interface ReorderStaffTypesInput {
  campusId: string;
  ids: string[];
}

@Injectable()
export class ReorderStaffTypesUseCase {
  private readonly logger = new Logger(ReorderStaffTypesUseCase.name);

  constructor(
    @Inject("STAFF_TYPE_REPOSITORY")
    private readonly staffTypeRepository: StaffTypeRepository,
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(
    input: ReorderStaffTypesInput,
    currentUser: User,
  ): Promise<StaffType[]> {
    this.logger.log(`Reordering ${input.ids.length} staff types`);

    const uniqueIds = new Set(input.ids);
    if (uniqueIds.size !== input.ids.length) {
      throw new BadRequestException("Staff type IDs must be unique");
    }

    // Step 1: Validate all IDs exist and belong to the specified campus
    const missingIds: string[] = [];
    const staffTypes: StaffType[] = [];
    for (const id of input.ids) {
      const staffType = await this.staffTypeRepository.findById(id);
      if (!staffType) {
        missingIds.push(id);
      } else if (staffType.campusId !== input.campusId) {
        // Staff type belongs to a different campus - return 404 for security
        throw new NotFoundException(
          `Staff type with ID ${id} not found in this campus`,
        );
      } else {
        staffTypes.push(staffType);
      }
    }

    if (missingIds.length > 0) {
      throw new BadRequestException(
        `Staff type(s) not found: ${missingIds.join(", ")}`,
      );
    }

    const beforeAudit = pickStaffTypeOrderAuditFields(staffTypes);

    // Step 2: Reorder staff types and audit within one transaction.
    const reorderedStaffTypes = await this.unitOfWork.run(async (tx) => {
      const reordered = await tx.reorderStaffTypes(input.campusId, input.ids);
      await tx.recordAudit({
        actorId: currentUser.id,
        action: "REORDER_STAFF_TYPES",
        targetType: "staff_type",
        targetId: input.ids[0],
        campusId: input.campusId,
        context: buildStaffTypesReorderAuditContext(
          input.campusId,
          input.ids,
          currentUser,
        ),
        beforeValue: beforeAudit,
        afterValue: pickStaffTypeOrderAuditFields(reordered),
      });

      return reordered;
    });

    this.logger.log(
      `Successfully reordered ${reorderedStaffTypes.length} staff types`,
    );

    return reorderedStaffTypes;
  }
}
