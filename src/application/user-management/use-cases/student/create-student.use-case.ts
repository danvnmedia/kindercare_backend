import {
  Injectable,
  Inject,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import { Student } from "@/domain/user-management/entities/student.entity";
import { Gender } from "@/domain/user-management/enums/gender.enum";
import { StudentStatus } from "@/domain/user-management/enums/student-status.enum";
import { User } from "@/domain/user-management/user.entity";
import { StudentRepository } from "../../ports/student.repository";
import { GuardianRepository } from "../../ports/guardian.repository";
import { UserRepository } from "../../ports/user.repository";
import { IdentityService } from "@/infra/external-services/clerk/identity.service";

const DEFAULT_WEAK_PASSWORD = "ChangeMe123!";

export interface CreateStudentInput {
  fullName: string;
  nickname?: string;
  dateOfBirth?: Date;
  gender?: Gender;
  phoneNumber?: string;
  email?: string;
  address?: string;
  status?: StudentStatus;
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
    @Inject("USER_REPOSITORY")
    private readonly userRepository: UserRepository,
    private readonly identityService: IdentityService,
  ) {}

  async execute(input: CreateStudentInput): Promise<Student> {
    try {
      this.logger.log(`Creating student: ${input.fullName}`);

      // Step 1: Validate guardians exist (if provided)
      if (input.guardianIds && input.guardianIds.length > 0) {
        await this.validateGuardians(input.guardianIds);
      }

      // Step 2: Check Student uniqueness (email/phone)
      await this.checkStudentUniqueness(input);

      // Step 3: Create and save the Student entity
      const student = await this.createAndSaveStudent(input);
      this.logger.log(`Student created: ${student.id}`);

      // Step 4: Assign Guardians (if provided)
      if (input.guardianIds && input.guardianIds.length > 0) {
        await this.assignGuardians(student.id, input.guardianIds);
        this.logger.log(
          `Assigned ${input.guardianIds.length} guardians to student ${student.id}`,
        );
      }

      // Step 5: Create User + Clerk (if requested)
      if (input.createUserAccount) {
        await this.createUserAccount(student);
        this.logger.log(`User account created for student ${student.id}`);
      }

      // Step 6: Return created student with relations
      const createdStudent = await this.studentRepository.findById(student.id);
      if (!createdStudent) {
        throw new Error("Failed to retrieve created student");
      }

      this.logger.log(`Student creation completed: ${createdStudent.id}`);
      return createdStudent;
    } catch (error) {
      this.logger.error(
        `Failed to create student: ${error.message}`,
        error.stack,
      );
      // Re-throw specific exceptions or a generic one
      if (
        error instanceof ConflictException ||
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      // Catch errors from Student.create() and wrap them in BadRequestException
      throw new BadRequestException(error.message);
    }
  }

  private async checkStudentUniqueness(
    input: CreateStudentInput,
  ): Promise<void> {
    if (input.email) {
      const existingByEmail = await this.studentRepository.findByEmail(
        input.email,
      );
      if (existingByEmail) {
        throw new ConflictException(
          `Student with email ${input.email} already exists`,
        );
      }
    }

    if (input.phoneNumber) {
      const existingByPhone = await this.studentRepository.findByPhoneNumber(
        input.phoneNumber,
      );
      if (existingByPhone) {
        throw new ConflictException(
          `Student with phone number ${input.phoneNumber} already exists`,
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

  private async createAndSaveStudent(
    input: CreateStudentInput,
  ): Promise<Student> {
    const studentEntity = Student.create({
      studentCode: randomUUID(), // Or generate based on a pattern
      fullName: input.fullName,
      email: input.email || null,
      phoneNumber: input.phoneNumber || null,
      address: input.address || null,
      dateOfBirth: input.dateOfBirth || null,
      nickname: input.nickname || null,
      gender: input.gender || null,
      status: input.status || StudentStatus.WAITING,
    });

    return await this.studentRepository.save(studentEntity);
  }

  private async assignGuardians(
    studentId: string,
    guardianIds: string[],
  ): Promise<void> {
    const guardianRelations = guardianIds.map((guardianId) => ({
      guardianId,
      relationshipId: "GUARDIAN", // Default relationship
    }));
    await this.studentRepository.assignGuardians(studentId, guardianRelations);
  }

  private async createUserAccount(student: Student): Promise<void> {
    if (!student.email && !student.phoneNumber) {
      throw new BadRequestException(
        "Email or phone number is required to create a user account",
      );
    }
    try {
      this.logger.log(
        `Creating Clerk user for: ${student.email || student.phoneNumber}`,
      );
      const clerkUser = await this.identityService.provisionUser({
        email: student.email || undefined,
        fullName: student.fullName,
        phoneNumber: student.phoneNumber || undefined,
        password: DEFAULT_WEAK_PASSWORD,
      });

      const userEntity = User.create({
        clerkUid: clerkUser.clerkUid,
        isActive: true,
      });
      await this.userRepository.save(userEntity);
      this.logger.log(`User account created: ${clerkUser.clerkUid}`);
    } catch (error) {
      this.logger.error(
        `Failed to create user account: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Could not create user account: ${error.message}`,
      );
    }
  }
}
