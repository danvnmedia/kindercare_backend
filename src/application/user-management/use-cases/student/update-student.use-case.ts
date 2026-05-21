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
import { User } from "@/domain/user-management/user.entity";
import { StudentRepository } from "../../ports/student.repository";
import { UnitOfWorkPort } from "@/application/ports/unit-of-work.port";
import { computeDiff } from "@/application/audit";
import { Gender } from "@/domain/user-management/enums/gender.enum";

export interface UpdateStudentInput {
  fullName?: string;
  nickname?: string;
  dateOfBirth?: Date;
  gender?: Gender;
  phoneNumber?: string;
  email?: string;
  address?: string;
}

@Injectable()
export class UpdateStudentUseCase {
  private readonly logger = new Logger(UpdateStudentUseCase.name);

  constructor(
    @Inject("STUDENT_REPOSITORY")
    private readonly studentRepository: StudentRepository,
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(
    id: string,
    input: UpdateStudentInput,
    currentUser: User,
  ): Promise<Student> {
    this.logger.log(`Updating student: ${id}`);

    // Step 1: Find existing student
    const student = await this.studentRepository.findById(id);
    if (!student) {
      throw new NotFoundException(`Student with ID ${id} not found`);
    }

    // Step 2: Check email uniqueness within campus (if email is being changed)
    if (input.email !== undefined && input.email !== student.email) {
      await this.checkEmailUniqueness(student.campusId, input.email, id);
    }

    // Step 3: Check phone number uniqueness within campus (if phone is being changed)
    if (
      input.phoneNumber !== undefined &&
      input.phoneNumber !== student.phoneNumber
    ) {
      await this.checkPhoneUniqueness(student.campusId, input.phoneNumber, id);
    }

    // Step 4: Update student profile using entity method.
    // Snapshot before/after so the EDIT_STUDENT_PROFILE audit row records
    // only the fields that actually changed (Scenario 3 of
    // `@doc/specs/admin-audit-log`).
    const beforeAudit = pickStudentAuditFields(student);

    const updateData: UpdateStudentData = {
      fullName: input.fullName,
      nickname: input.nickname,
      dateOfBirth: input.dateOfBirth,
      gender: input.gender,
      phoneNumber: input.phoneNumber,
      email: input.email,
      address: input.address,
    };

    student.updateProfile(updateData);

    const afterAudit = pickStudentAuditFields(student);
    const diff = computeDiff(beforeAudit, afterAudit);

    // Step 5: Persist + emit audit through UnitOfWork — same transaction
    // boundary (D4 of `@doc/specs/admin-audit-log`). Skip the audit emit
    // when no auditable field changed, so no-op PATCHes do not pollute the
    // history.
    await this.unitOfWork.run(async (tx) => {
      await tx.updateStudent(student.id, {
        fullName: student.fullName,
        email: student.email,
        phoneNumber: student.phoneNumber,
        address: student.address,
        dateOfBirth: student.dateOfBirth,
        nickname: student.nickname,
        gender: student.gender,
        updatedAt: student.updatedAt,
      });

      if (Object.keys(diff.after).length > 0) {
        await tx.recordAudit({
          actorId: currentUser.id,
          action: "EDIT_STUDENT_PROFILE",
          targetType: "student",
          targetId: id,
          campusId: student.campusId,
          context: { actorName: currentUser.profile?.fullName ?? null },
          beforeValue: diff.before,
          afterValue: diff.after,
        });
      }
    });

    this.logger.log(`Student updated successfully: ${id}`);
    return student;
  }

  private async checkEmailUniqueness(
    campusId: string,
    email: string | null,
    excludeId: string,
  ): Promise<void> {
    if (!email) return;

    const existingStudent = await this.studentRepository.findByEmailInCampus(
      campusId,
      email,
    );
    if (existingStudent && existingStudent.id !== excludeId) {
      throw new ConflictException(
        `Student with email ${email} already exists in this campus`,
      );
    }
  }

  private async checkPhoneUniqueness(
    campusId: string,
    phoneNumber: string | null,
    excludeId: string,
  ): Promise<void> {
    if (!phoneNumber) return;

    const existingStudent =
      await this.studentRepository.findByPhoneNumberInCampus(
        campusId,
        phoneNumber,
      );
    if (existingStudent && existingStudent.id !== excludeId) {
      throw new ConflictException(
        `Student with phone number ${phoneNumber} already exists in this campus`,
      );
    }
  }
}

function pickStudentAuditFields(s: Student) {
  return {
    fullName: s.fullName,
    email: s.email,
    phoneNumber: s.phoneNumber,
    address: s.address,
    dateOfBirth: s.dateOfBirth,
    nickname: s.nickname,
    gender: s.gender,
  };
}
