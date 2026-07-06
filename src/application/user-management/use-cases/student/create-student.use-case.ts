import {
  Injectable,
  Inject,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { StudentCodeGeneratorPort } from "@/application/ports/student-code-generator.port";
import { UnitOfWorkPort } from "@/application/ports/unit-of-work.port";
import { Student } from "@/domain/user-management/entities/student.entity";
import { Gender } from "@/domain/user-management/enums/gender.enum";
import { User } from "@/domain/user-management/user.entity";
import { StudentRepository } from "../../ports/student.repository";
import { GuardianRepository } from "../../ports/guardian.repository";

export interface CreateStudentInput {
  campusId: string;
  fullName: string;
  nickname?: string;
  dateOfBirth?: Date;
  gender?: Gender;
  phoneNumber?: string;
  email?: string;
  address?: string;
  createUserAccount?: boolean;
  guardianIds?: string[];
}

@Injectable()
export class CreateStudentUseCase {
  private readonly logger = new Logger(CreateStudentUseCase.name);

  constructor(
    @Inject("STUDENT_REPOSITORY")
    private readonly studentRepository: StudentRepository,
    @Inject("GUARDIAN_REPOSITORY")
    private readonly guardianRepository: GuardianRepository,
    private readonly unitOfWork: UnitOfWorkPort,
    private readonly studentCodeGenerator: StudentCodeGeneratorPort,
  ) {}

  async execute(
    input: CreateStudentInput,
    currentUser: User,
  ): Promise<Student> {
    this.logger.log(
      `Creating student: ${input.fullName} in campus: ${input.campusId}`,
    );

    try {
      // Step 1: Pre-flight validation (no DB writes)
      if (input.createUserAccount === true) {
        throw new BadRequestException(
          "Student account creation is not supported yet. Create the student profile without createUserAccount.",
        );
      }

      if (input.guardianIds && input.guardianIds.length > 0) {
        await this.validateGuardians(input.guardianIds);
      }
      await this.checkStudentUniqueness(input);

      // Step 2: Generate campus-scoped student code (outside UoW)
      const studentCode = await this.studentCodeGenerator.generateNextCode(
        input.campusId,
      );

      // Step 3: Build the Student domain entity (validation happens in factory)
      const studentEntity = Student.create({
        campusId: input.campusId,
        studentCode,
        fullName: input.fullName,
        email: input.email || null,
        phoneNumber: input.phoneNumber || null,
        address: input.address || null,
        dateOfBirth: input.dateOfBirth || null,
        nickname: input.nickname || null,
        gender: input.gender || null,
      });

      // Step 4: DB Transaction — create the student profile, optional guardian
      // assignments, and the audit row atomically (D4 of
      // @doc/specs/admin-audit-log). Student login identity remains out of
      // scope until a dedicated student account flow exists.
      await this.unitOfWork.run(async (tx) => {
        await tx.createStudent({
          id: studentEntity.id,
          campusId: studentEntity.campusId,
          studentCode: studentEntity.studentCode,
          fullName: studentEntity.fullName,
          email: studentEntity.email,
          phoneNumber: studentEntity.phoneNumber,
          address: studentEntity.address,
          dateOfBirth: studentEntity.dateOfBirth,
          nickname: studentEntity.nickname,
          gender: studentEntity.gender,
          isArchived: studentEntity.isArchived,
          createdAt: studentEntity.createdAt,
          updatedAt: studentEntity.updatedAt,
        });

        if (input.guardianIds && input.guardianIds.length > 0) {
          await tx.assignGuardians(
            studentEntity.id,
            input.guardianIds.map((guardianId) => ({
              guardianId,
              relationshipId: "GUARDIAN",
            })),
          );
        }

        await tx.recordAudit({
          actorId: currentUser.id,
          action: "CREATE_STUDENT",
          targetType: "student",
          targetId: studentEntity.id,
          campusId: studentEntity.campusId,
          context: {
            actorName: currentUser.profile?.fullName ?? null,
            name: studentEntity.fullName,
            code: studentEntity.studentCode,
          },
        });
      });

      this.logger.log(
        `Student created: ${studentEntity.id} in campus: ${input.campusId}`,
      );

      // Step 5: Re-read the student with guardian relations attached
      const createdStudent = await this.studentRepository.findById(
        studentEntity.id,
      );
      if (!createdStudent) {
        throw new Error("Failed to retrieve created student");
      }
      return createdStudent;
    } catch (error) {
      this.logger.error(
        `Failed to create student: ${error.message}`,
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

  private async checkStudentUniqueness(
    input: CreateStudentInput,
  ): Promise<void> {
    if (input.email) {
      const existingByEmail = await this.studentRepository.findByEmailInCampus(
        input.campusId,
        input.email,
      );
      if (existingByEmail) {
        throw new ConflictException(
          `Student with email ${input.email} already exists in this campus`,
        );
      }
    }

    if (input.phoneNumber) {
      const existingByPhone =
        await this.studentRepository.findByPhoneNumberInCampus(
          input.campusId,
          input.phoneNumber,
        );
      if (existingByPhone) {
        throw new ConflictException(
          `Student with phone number ${input.phoneNumber} already exists in this campus`,
        );
      }
    }
  }

  private async validateGuardians(guardianIds: string[]): Promise<void> {
    const guardians = await this.guardianRepository.findByIds(guardianIds);
    const foundIds = guardians.map((p) => p.id);
    const missingIds = guardianIds.filter((id) => !foundIds.includes(id));

    if (missingIds.length > 0) {
      throw new NotFoundException(
        `Guardians not found: ${missingIds.join(", ")}`,
      );
    }
  }
}
