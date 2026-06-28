import {
  Injectable,
  Inject,
  ConflictException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { Campus } from "@/domain/campus/entities/campus.entity";
import { CampusRepository } from "../ports/campus.repository";

export interface CreateCampusInput {
  name: string;
  address?: string | null;
  phoneNumber?: string | null;
  isArchived?: boolean;
}

@Injectable()
export class CreateCampusUseCase {
  private readonly logger = new Logger(CreateCampusUseCase.name);

  constructor(
    @Inject("CAMPUS_REPOSITORY")
    private readonly campusRepository: CampusRepository,
  ) {}

  async execute(input: CreateCampusInput): Promise<Campus> {
    try {
      this.logger.log(`Creating campus: ${input.name}`);

      // Check for duplicate name
      const existingByName = await this.campusRepository.findByName(input.name);
      if (existingByName) {
        throw new ConflictException(`Campus "${input.name}" already exists`);
      }

      // Create domain entity (validation happens in factory)
      const campus = Campus.create({
        name: input.name,
        address: input.address ?? null,
        phoneNumber: input.phoneNumber ?? null,
        isArchived: input.isArchived,
      });

      // Save to repository
      const savedCampus = await this.campusRepository.save(campus);
      this.logger.log(`Campus created: ${savedCampus.id}`);

      return savedCampus;
    } catch (error) {
      this.logger.error(
        `Failed to create campus: ${error.message}`,
        error.stack,
      );
      if (error instanceof ConflictException) {
        throw error;
      }
      throw new BadRequestException(error.message);
    }
  }
}
