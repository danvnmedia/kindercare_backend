import { Injectable, Inject, NotFoundException, Logger } from "@nestjs/common";
import { Campus } from "@/domain/campus/entities/campus.entity";
import { CampusRepository } from "../ports/campus.repository";

@Injectable()
export class GetCampusByIdUseCase {
  private readonly logger = new Logger(GetCampusByIdUseCase.name);

  constructor(
    @Inject("CAMPUS_REPOSITORY")
    private readonly campusRepository: CampusRepository,
  ) {}

  async execute(id: string): Promise<Campus> {
    this.logger.log(`Getting campus by ID: ${id}`);

    const campus = await this.campusRepository.findById(id);

    if (!campus) {
      throw new NotFoundException(`Campus with ID "${id}" not found`);
    }

    return campus;
  }
}
