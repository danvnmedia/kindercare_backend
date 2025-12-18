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
import { Guardian } from "@/domain/user-management/entities/guardian.entity";

export interface LinkStudentWithGuardianInput {
  studentId: string;
  guardianId: string;
  relationshipId: string; // FATHER, MOTHER, GUARDIAN
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
  ) {}

  async execute(
    input: LinkStudentWithGuardianInput,
  ): Promise<LinkStudentWithGuardianOutput> {
    try {
      this.logger.log(
        `Linking student ${input.studentId} with guardian ${input.guardianId} (${input.relationshipId})`,
      );

      // Validate relationship ID
      if (!Guardian.validateRelationshipId(input.relationshipId)) {
        throw new BadRequestException(
          `Invalid relationship ID: ${input.relationshipId}. Must be FATHER, MOTHER, or GUARDIAN`,
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

      // Get relationship name
      const relationshipName = Guardian.getGuardianType(input.relationshipId);

      return {
        studentId: input.studentId,
        guardianId: input.guardianId,
        relationshipId: input.relationshipId,
        relationshipName,
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
