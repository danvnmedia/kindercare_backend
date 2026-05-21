import {
  Injectable,
  Inject,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { IdentityPort } from "@/application/ports/identity.port";
import { StudentCodeGeneratorPort } from "@/application/ports/student-code-generator.port";
import { UnitOfWorkPort } from "@/application/ports/unit-of-work.port";
import { Student } from "@/domain/user-management/entities/student.entity";
import { Gender } from "@/domain/user-management/enums/gender.enum";
import { User } from "@/domain/user-management/user.entity";
import { StudentRepository } from "../../ports/student.repository";
import { GuardianRepository } from "../../ports/guardian.repository";

const DEFAULT_WEAK_PASSWORD = "ChangeMe123!";

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

interface ClerkUserResult {
  clerkUid: string;
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
    private readonly identityPort: IdentityPort,
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
      if (input.guardianIds && input.guardianIds.length > 0) {
        await this.validateGuardians(input.guardianIds);
      }
      await this.checkStudentUniqueness(input);

      if (input.createUserAccount && !input.email && !input.phoneNumber) {
        throw new BadRequestException(
          "Email or phone number is required to create a user account",
        );
      }

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

      // Step 4: Create Clerk user FIRST (external service, most likely to fail).
      // Mirrors the Guardian/Staff Clerk-first → UoW → compensate-on-throw
      // pattern so the DB transaction stays the unit of atomicity.
      const clerkUser = input.createUserAccount
        ? await this.createClerkUser(studentEntity)
        : null;

      try {
        // Step 5: DB Transaction — create student, optional user, optional
        // guardian assignments, and the audit row atomically (D4 of
        // @doc/specs/admin-audit-log).
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

          if (clerkUser) {
            await tx.createUser({
              clerkUid: clerkUser.clerkUid,
              isActive: true,
            });
          }

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
      } catch (error) {
        // Step 6: Compensation — delete Clerk user if the DB transaction
        // (including the audit row) failed.
        if (clerkUser) {
          this.logger.error(
            `DB transaction failed, compensating by deleting Clerk user: ${clerkUser.clerkUid}`,
          );
          await this.compensateClerkUser(clerkUser.clerkUid);
        }
        throw error;
      }

      this.logger.log(
        `Student created: ${studentEntity.id} in campus: ${input.campusId}`,
      );

      // Step 7: Re-read the student with guardian relations attached
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

  private async createClerkUser(student: Student): Promise<ClerkUserResult> {
    this.logger.log(
      `Creating Clerk user for: ${student.email || student.phoneNumber}`,
    );
    try {
      const clerkUser = await this.identityPort.provisionUser({
        email: student.email || undefined,
        fullName: student.fullName,
        phoneNumber: student.phoneNumber || undefined,
        password: DEFAULT_WEAK_PASSWORD,
      });
      return clerkUser;
    } catch (error) {
      this.logger.error(
        `Failed to create Clerk user: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Could not create user account: ${error.message}`,
      );
    }
  }

  private async compensateClerkUser(clerkUid: string): Promise<void> {
    try {
      await this.identityPort.deleteIdentity(clerkUid);
      this.logger.log(
        `Compensation successful: Clerk user deleted: ${clerkUid}`,
      );
    } catch (compensationError) {
      this.logger.error(
        `Compensation FAILED: Could not delete Clerk user ${clerkUid}. Manual cleanup required.`,
        compensationError.stack,
      );
    }
  }
}
