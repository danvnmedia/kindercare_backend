import {
  Injectable,
  Inject,
  ConflictException,
  BadRequestException,
  NotFoundException,
  Logger,
} from "@nestjs/common";
import { UnitOfWorkPort } from "@/application/ports/unit-of-work.port";
import { StaffType } from "@/domain/user-management/entities/staff-type.entity";
import { User } from "@/domain/user-management/user.entity";
import { StaffTypeRepository } from "../../ports/staff-type.repository";
import { RoleRepository } from "../../ports/role.repository";
import {
  buildStaffTypeAuditContext,
  pickStaffTypeAuditFields,
} from "./staff-type-audit";
import { loadAllowedDefaultRole } from "./staff-type-default-role.policy";

export interface CreateStaffTypeInput {
  campusId: string;
  name: string;
  description?: string | null;
  defaultRoleId?: string | null;
  isArchived?: boolean;
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
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(
    input: CreateStaffTypeInput,
    currentUser: User,
  ): Promise<StaffType> {
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

      let defaultRoleId = input.defaultRoleId ?? null;

      // Validate defaultRoleId if provided; otherwise use the backend-managed
      // minimal access role so future staff creates are campus-discoverable
      // without requiring frontend default-role setup.
      if (input.defaultRoleId) {
        await loadAllowedDefaultRole(
          this.roleRepository,
          input.defaultRoleId,
          input.campusId,
        );
      } else {
        const fallbackRole = await this.roleRepository.ensureCampusAccessRole(
          input.campusId,
        );
        defaultRoleId = fallbackRole.id;
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
        defaultRoleId,
        isArchived: input.isArchived,
        order,
      });

      // Save and audit atomically.
      const savedStaffType = await this.unitOfWork.run(async (tx) => {
        const saved = await tx.createStaffType(staffType);
        await tx.recordAudit({
          actorId: currentUser.id,
          action: "CREATE_STAFF_TYPE",
          targetType: "staff_type",
          targetId: saved.id,
          campusId: input.campusId,
          context: buildStaffTypeAuditContext(
            saved,
            input.campusId,
            currentUser,
          ),
          afterValue: pickStaffTypeAuditFields(saved),
        });

        return saved;
      });
      this.logger.log(`Staff type created: ${savedStaffType.id}`);

      return savedStaffType;
    } catch (error) {
      this.logger.error(
        `Failed to create staff type: ${error.message}`,
        error.stack,
      );
      if (
        error instanceof ConflictException ||
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new BadRequestException(error.message);
    }
  }
}
