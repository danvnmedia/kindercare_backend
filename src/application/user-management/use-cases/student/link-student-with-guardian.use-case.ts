import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from "@nestjs/common";
import { StudentRepository } from "../../ports/student.repository";
import { GuardianRepository } from "../../ports/guardian.repository";
import { GuardianRelationshipTypeRepository } from "../../ports/guardian-relationship-type.repository";

export interface LinkStudentWithGuardianInput {
  studentId: string;
  guardianId: string;
  relationshipId: string;
}

export interface LinkStudentWithGuardianOutput {
  studentId: string;
  guardianId: string;
  relationshipId: string;
  relationshipName: string;
}

@Injectable()
export class LinkStudentWithGuardianUseCase {
  private readonly logger = new Logger(LinkStudentWithGuardianUseCase.name);

  constructor(
    @Inject("STUDENT_REPOSITORY")
    private readonly studentRepository: StudentRepository,
    @Inject("GUARDIAN_REPOSITORY")
    private readonly guardianRepository: GuardianRepository,
    @Inject("GUARDIAN_RELATIONSHIP_TYPE_REPOSITORY")
    private readonly guardianRelationshipTypeRepository: GuardianRelationshipTypeRepository,
  ) {}

  async execute(
    input: LinkStudentWithGuardianInput,
  ): Promise<LinkStudentWithGuardianOutput> {
    try {
      this.logger.log(
        `Linking student ${input.studentId} with guardian ${input.guardianId} (${input.relationshipId})`,
      );

      // Validate relationship type exists and is not archived
      const relationshipType =
        await this.guardianRelationshipTypeRepository.findById(
          input.relationshipId,
        );
      if (!relationshipType) {
        throw new NotFoundException(
          `Guardian relationship type with ID "${input.relationshipId}" not found`,
        );
      }
      if (relationshipType.isArchived) {
        throw new BadRequestException(
          `Guardian relationship type "${relationshipType.name}" is archived and cannot be used`,
        );
      }

      // Check student exists
      const student = await this.studentRepository.findById(input.studentId);
      if (!student) {
        throw new NotFoundException(
          `Student with ID ${input.studentId} not found`,
        );
      }

      // Check guardian exists
      const guardian = await this.guardianRepository.findById(input.guardianId);
      if (!guardian) {
        throw new NotFoundException(
          `Guardian with ID ${input.guardianId} not found`,
        );
      }

      // Check if relationship already exists
      const existingGuardians =
        await this.studentRepository.getStudentGuardians(input.studentId);
      const existingRelation = existingGuardians.find(
        (g) => g.guardianId === input.guardianId,
      );
      if (existingRelation) {
        throw new ConflictException(
          `Guardian ${input.guardianId} is already linked to student ${input.studentId}`,
        );
      }

      // Create the link
      await this.studentRepository.assignGuardians(input.studentId, [
        {
          guardianId: input.guardianId,
          relationshipId: input.relationshipId,
        },
      ]);

      this.logger.log(
        `Successfully linked student ${input.studentId} with guardian ${input.guardianId}`,
      );

      return {
        studentId: input.studentId,
        guardianId: input.guardianId,
        relationshipId: input.relationshipId,
        relationshipName: relationshipType.name,
      };
    } catch (error) {
      this.logger.error(
        `Failed to link student with guardian: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
