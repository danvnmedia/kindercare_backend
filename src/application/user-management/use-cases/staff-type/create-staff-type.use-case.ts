import {
  Injectable,
  Inject,
  ConflictException,
  BadRequestException,
  NotFoundException,
  Logger,
} from "@nestjs/common";
import { StaffType } from "@/domain/user-management/entities/staff-type.entity";
import { StaffTypeRepository } from "../../ports/staff-type.repository";
import { RoleRepository } from "../../ports/role.repository";

export interface CreateStaffTypeInput {
  campusId: string;
  name: string;
  description?: string | null;
  defaultRoleId?: string | null;
  isActive?: boolean;
  order?: number;
}

@Injectable()
export class CreateStaffTypeUseCase {
  private readonly logger = new Logger(CreateStaffTypeUseCase.name);

  constructor(
    @Inject("STAFF_TYPE_REPOSITORY")
    private readonly staffTypeRepository: StaffTypeRepository,
    @Inject("ROLE_REPOSITORY")
    private readonly roleRepository: RoleRepository,
  ) {}

  async execute(input: CreateStaffTypeInput): Promise<StaffType> {
    try {
      this.logger.log(
        `Creating staff type: ${input.name} for campus: ${input.campusId}`,
      );

      // Check for duplicate name within the same campus
      const existingByName = await this.staffTypeRepository.findByName(
        input.campusId,
        input.name,
      );
      if (existingByName) {
        throw new ConflictException(
          `Staff type "${input.name}" already exists in this campus`,
        );
      }

      // Validate defaultRoleId if provided
      if (input.defaultRoleId) {
        const roleExists = await this.roleRepository.exists(
          input.defaultRoleId,
        );
        if (!roleExists) {
          throw new NotFoundException(
            `Role with ID "${input.defaultRoleId}" not found`,
          );
        }
      }

      // Determine order: use provided order or auto-assign using maxOrder + 1
      let order: number;
      if (input.order !== undefined) {
        // Validate order uniqueness when explicitly provided
        const existingByOrder =
          await this.staffTypeRepository.findByOrderAndCampus(
            input.order,
            input.campusId,
          );
        if (existingByOrder) {
          throw new ConflictException(
            `A staff type with order ${input.order} already exists in this campus`,
          );
        }
        order = input.order;
      } else {
        // Auto-assign order: maxOrder + 1
        const maxOrder = await this.staffTypeRepository.getMaxOrder(
          input.campusId,
        );
        order = maxOrder + 1;
      }

      // Create domain entity (validation happens in factory)
      const staffType = StaffType.create({
        campusId: input.campusId,
        name: input.name,
        description: input.description ?? null,
        defaultRoleId: input.defaultRoleId ?? null,
        isActive: input.isActive ?? true,
        order,
      });

      // Save to repository
      const savedStaffType = await this.staffTypeRepository.save(staffType);
      this.logger.log(`Staff type created: ${savedStaffType.id}`);

      return savedStaffType;
    } catch (error) {
      this.logger.error(
        `Failed to create staff type: ${error.message}`,
        error.stack,
      );
      if (
        error instanceof ConflictException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException(error.message);
    }
  }
}
