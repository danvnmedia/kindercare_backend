import { Injectable, Inject, Logger } from "@nestjs/common";
import { Campus } from "@/domain/campus/entities/campus.entity";
import { CampusRepository } from "../ports/campus.repository";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";

@Injectable()
export class GetAllCampusesUseCase {
  private readonly logger = new Logger(GetAllCampusesUseCase.name);

  constructor(
    @Inject("CAMPUS_REPOSITORY")
    private readonly campusRepository: CampusRepository,
  ) {}

  async execute(params: StandardRequest): Promise<PaginatedResult<Campus>> {
    this.logger.log("Getting all campuses");

    return await this.campusRepository.findAll(params);
  }
}
