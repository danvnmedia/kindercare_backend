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

export interface LinkStudentToGuardianInput {
  guardianId: string;
  studentId: string;
  relationshipId: string;
}

export interface LinkStudentToGuardianOutput {
  guardianId: string;
  studentId: string;
  relationshipId: string;
  relationshipName: string;
}

@Injectable()
export class LinkStudentToGuardianUseCase {
  private readonly logger = new Logger(LinkStudentToGuardianUseCase.name);

  constructor(
    @Inject("STUDENT_REPOSITORY")
    private readonly studentRepository: StudentRepository,
    @Inject("GUARDIAN_REPOSITORY")
    private readonly guardianRepository: GuardianRepository,
    @Inject("GUARDIAN_RELATIONSHIP_TYPE_REPOSITORY")
    private readonly guardianRelationshipTypeRepository: GuardianRelationshipTypeRepository,
  ) {}

  async execute(
    input: LinkStudentToGuardianInput,
  ): Promise<LinkStudentToGuardianOutput> {
    try {
      this.logger.log(
        `Linking student ${input.studentId} to guardian ${input.guardianId} (${input.relationshipId})`,
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

      // Check guardian exists
      const guardian = await this.guardianRepository.findById(input.guardianId);
      if (!guardian) {
        throw new NotFoundException(
          `Guardian with ID ${input.guardianId} not found`,
        );
      }

      // Check student exists
      const student = await this.studentRepository.findById(input.studentId);
      if (!student) {
        throw new NotFoundException(
          `Student with ID ${input.studentId} not found`,
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
          `Student ${input.studentId} is already linked to guardian ${input.guardianId}`,
        );
      }

      // Create the link (reuses existing student repository method)
      await this.studentRepository.assignGuardians(input.studentId, [
        {
          guardianId: input.guardianId,
          relationshipId: input.relationshipId,
        },
      ]);

      this.logger.log(
        `Successfully linked student ${input.studentId} to guardian ${input.guardianId}`,
      );

      return {
        guardianId: input.guardianId,
        studentId: input.studentId,
        relationshipId: input.relationshipId,
        relationshipName: relationshipType.name,
      };
    } catch (error) {
      this.logger.error(
        `Failed to link student to guardian: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
