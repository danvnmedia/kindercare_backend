import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
  Logger,
} from "@nestjs/common";
import { StaffType } from "@/domain/user-management/entities/staff-type.entity";
import { StaffTypeRepository } from "../../ports/staff-type.repository";

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
  ) {}

  async execute(input: ReorderStaffTypesInput): Promise<StaffType[]> {
    this.logger.log(`Reordering ${input.ids.length} staff types`);

    // Step 1: Validate all IDs exist and belong to the specified campus
    const missingIds: string[] = [];
    for (const id of input.ids) {
      const staffType = await this.staffTypeRepository.findById(id);
      if (!staffType) {
        missingIds.push(id);
      } else if (staffType.campusId !== input.campusId) {
        // Staff type belongs to a different campus - return 404 for security
        throw new NotFoundException(
          `Staff type with ID ${id} not found in this campus`,
        );
      }
    }

    if (missingIds.length > 0) {
      throw new BadRequestException(
        `Staff type(s) not found: ${missingIds.join(", ")}`,
      );
    }

    // Step 2: Reorder staff types within the campus
    const reorderedStaffTypes = await this.staffTypeRepository.reorder(
      input.campusId,
      input.ids,
    );

    this.logger.log(
      `Successfully reordered ${reorderedStaffTypes.length} staff types`,
    );

    return reorderedStaffTypes;
  }
}
