import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import {
  Campus,
  UpdateCampusData,
} from "@/domain/campus/entities/campus.entity";
import { CampusRepository } from "../ports/campus.repository";

export interface UpdateCampusInput {
  name?: string;
  address?: string | null;
  phoneNumber?: string | null;
  isActive?: boolean;
}

@Injectable()
export class UpdateCampusUseCase {
  private readonly logger = new Logger(UpdateCampusUseCase.name);

  constructor(
    @Inject("CAMPUS_REPOSITORY")
    private readonly campusRepository: CampusRepository,
  ) {}

  async execute(id: string, input: UpdateCampusInput): Promise<Campus> {
    try {
      this.logger.log(`Updating campus: ${id}`);

      // Find existing campus
      const campus = await this.campusRepository.findById(id);
      if (!campus) {
        throw new NotFoundException(`Campus with ID "${id}" not found`);
      }

      // Check for duplicate name if name is being changed
      if (input.name && input.name !== campus.name) {
        const existingByName = await this.campusRepository.findByName(
          input.name,
        );
        if (existingByName && existingByName.id !== id) {
          throw new ConflictException(`Campus "${input.name}" already exists`);
        }
      }

      // Build update data
      const updateData: UpdateCampusData = {};

      if (input.name !== undefined) {
        updateData.name = input.name;
      }
      if (input.address !== undefined) {
        updateData.address = input.address;
      }
      if (input.phoneNumber !== undefined) {
        updateData.phoneNumber = input.phoneNumber;
      }
      if (input.isActive !== undefined) {
        updateData.isActive = input.isActive;
      }

      // Update domain entity (validation happens in entity)
      campus.update(updateData);

      // Save to repository
      const updatedCampus = await this.campusRepository.update(campus);
      this.logger.log(`Campus updated: ${updatedCampus.id}`);

      return updatedCampus;
    } catch (error) {
      this.logger.error(
        `Failed to update campus: ${error.message}`,
        error.stack,
      );
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      throw new BadRequestException(error.message);
    }
  }
}
