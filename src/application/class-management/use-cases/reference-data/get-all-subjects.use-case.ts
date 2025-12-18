import { Injectable, Inject, Logger } from "@nestjs/common";
import { SubjectRepository } from "../../ports/subject.repository";
import { Subject } from "@/domain/class-management/entities/subject.entity";

@Injectable()
export class GetAllSubjectsUseCase {
  private readonly logger = new Logger(GetAllSubjectsUseCase.name);

  constructor(
    @Inject("SUBJECT_REPOSITORY")
    private readonly subjectRepository: SubjectRepository,
  ) {}

  async execute(): Promise<Subject[]> {
    try {
      this.logger.log("Fetching all subjects");

      const result = await this.subjectRepository.findAll();

      this.logger.log(`Found ${result.length} subjects`);

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to fetch subjects: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
