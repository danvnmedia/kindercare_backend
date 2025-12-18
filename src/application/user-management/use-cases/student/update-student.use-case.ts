import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  Logger,
} from "@nestjs/common";
import {
  Student,
  UpdateStudentData,
} from "@/domain/user-management/entities/student.entity";
import { StudentRepository } from "../../ports/student.repository";
import { Gender } from "@/domain/user-management/enums/gender.enum";
import { StudentStatus } from "@/domain/user-management/enums/student-status.enum";

export interface UpdateStudentInput {
  fullName?: string;
  nickname?: string;
  dateOfBirth?: Date;
  gender?: Gender;
  phoneNumber?: string;
  email?: string;
  address?: string;
  status?: StudentStatus;
}

@Injectable()
export class UpdateStudentUseCase {
  private readonly logger = new Logger(UpdateStudentUseCase.name);

  constructor(
    @Inject("STUDENT_REPOSITORY")
    private readonly studentRepository: StudentRepository,
  ) {}

  async execute(id: string, input: UpdateStudentInput): Promise<Student> {
    this.logger.log(`Updating student: ${id}`);

    // Step 1: Find existing student
    const student = await this.studentRepository.findById(id);
    if (!student) {
      throw new NotFoundException(`Student with ID ${id} not found`);
    }

    // Step 2: Check email uniqueness (if email is being changed)
    if (input.email !== undefined && input.email !== student.email) {
      await this.checkEmailUniqueness(input.email, id);
    }

    // Step 3: Check phone number uniqueness (if phone is being changed)
    if (
      input.phoneNumber !== undefined &&
      input.phoneNumber !== student.phoneNumber
    ) {
      await this.checkPhoneUniqueness(input.phoneNumber, id);
    }

    // Step 4: Update student profile using entity method
    const updateData: UpdateStudentData = {
      fullName: input.fullName,
      nickname: input.nickname,
      dateOfBirth: input.dateOfBirth,
      gender: input.gender,
      phoneNumber: input.phoneNumber,
      email: input.email,
      address: input.address,
      status: input.status,
    };

    student.updateProfile(updateData);

    // Step 5: Persist changes
    const updatedStudent = await this.studentRepository.update(student);

    this.logger.log(`Student updated successfully: ${id}`);
    return updatedStudent;
  }

  private async checkEmailUniqueness(
    email: string | null,
    excludeId: string,
  ): Promise<void> {
    if (!email) return;

    const existingStudent = await this.studentRepository.findByEmail(email);
    if (existingStudent && existingStudent.id !== excludeId) {
      throw new ConflictException(`Student with email ${email} already exists`);
    }
  }

  private async checkPhoneUniqueness(
    phoneNumber: string | null,
    excludeId: string,
  ): Promise<void> {
    if (!phoneNumber) return;

    const existingStudent =
      await this.studentRepository.findByPhoneNumber(phoneNumber);
    if (existingStudent && existingStudent.id !== excludeId) {
      throw new ConflictException(
        `Student with phone number ${phoneNumber} already exists`,
      );
    }
  }
}
