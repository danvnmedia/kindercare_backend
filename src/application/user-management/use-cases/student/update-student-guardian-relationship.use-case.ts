import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { GuardianRepository } from "../../ports/guardian.repository";
import { GuardianRelationshipTypeRepository } from "../../ports/guardian-relationship-type.repository";
import { StudentRepository } from "../../ports/student.repository";

export interface UpdateStudentGuardianRelationshipInput {
  studentId: string;
  guardianId: string;
  campusId: string;
  relationshipId: string;
}

export interface UpdateStudentGuardianRelationshipOutput {
  studentId: string;
  guardianId: string;
  relationshipId: string;
  relationshipName: string;
}

@Injectable()
export class UpdateStudentGuardianRelationshipUseCase {
  private readonly logger = new Logger(
    UpdateStudentGuardianRelationshipUseCase.name,
  );

  constructor(
    @Inject("STUDENT_REPOSITORY")
    private readonly studentRepository: StudentRepository,
    @Inject("GUARDIAN_REPOSITORY")
    private readonly guardianRepository: GuardianRepository,
    @Inject("GUARDIAN_RELATIONSHIP_TYPE_REPOSITORY")
    private readonly guardianRelationshipTypeRepository: GuardianRelationshipTypeRepository,
  ) {}

  async execute(
    input: UpdateStudentGuardianRelationshipInput,
  ): Promise<UpdateStudentGuardianRelationshipOutput> {
    try {
      this.logger.log(
        `Updating relationship for student ${input.studentId} / guardian ${input.guardianId} to ${input.relationshipId}`,
      );

      const relationshipType =
        await this.guardianRelationshipTypeRepository.findById(
          input.relationshipId,
        );
      if (!relationshipType) {
        throw new NotFoundException(
          `Guardian relationship type with ID "${input.relationshipId}" not found`,
        );
      }
      if (relationshipType.campusId !== input.campusId) {
        throw new NotFoundException(
          `Guardian relationship type with ID "${input.relationshipId}" not found in this campus`,
        );
      }
      if (relationshipType.isArchived) {
        throw new BadRequestException(
          `Guardian relationship type "${relationshipType.name}" is archived and cannot be used`,
        );
      }

      const student = await this.studentRepository.findById(input.studentId);
      if (!student || student.campusId !== input.campusId) {
        throw new NotFoundException(
          `Student with ID ${input.studentId} not found in this campus`,
        );
      }

      const guardian = await this.guardianRepository.findById(input.guardianId);
      if (!guardian || guardian.campusId !== input.campusId) {
        throw new NotFoundException(
          `Guardian with ID ${input.guardianId} not found in this campus`,
        );
      }

      const existingGuardians =
        await this.studentRepository.getStudentGuardians(input.studentId);
      const existingLink = existingGuardians.find(
        (g) => g.guardianId === input.guardianId,
      );
      if (!existingLink) {
        throw new NotFoundException(
          `Guardian ${input.guardianId} is not linked to student ${input.studentId}`,
        );
      }

      await this.studentRepository.updateGuardianRelationship(
        input.studentId,
        input.guardianId,
        input.relationshipId,
      );

      this.logger.log(
        `Successfully updated relationship for student ${input.studentId} / guardian ${input.guardianId}`,
      );

      return {
        studentId: input.studentId,
        guardianId: input.guardianId,
        relationshipId: input.relationshipId,
        relationshipName: relationshipType.name,
      };
    } catch (error) {
      this.logger.error(
        `Failed to update student-guardian relationship: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
