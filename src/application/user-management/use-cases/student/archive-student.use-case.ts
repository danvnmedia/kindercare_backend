import { Injectable, Inject, NotFoundException, Logger } from "@nestjs/common";
import { Student } from "@/domain/user-management/entities/student.entity";
import { User } from "@/domain/user-management/user.entity";
import { UnitOfWorkPort } from "@/application/ports/unit-of-work.port";
import { StudentRepository } from "../../ports/student.repository";

/**
 * Archive Student Use Case (Soft Delete)
 *
 * Flips `isArchived=true` inside a UoW so the `ARCHIVE_STUDENT` audit row
 * lands in the same transaction (D4 of @doc/specs/admin-audit-log).
 *
 * Students have no Clerk identity, so no saga is needed.
 */
@Injectable()
export class ArchiveStudentUseCase {
  private readonly logger = new Logger(ArchiveStudentUseCase.name);

  constructor(
    @Inject("STUDENT_REPOSITORY")
    private readonly studentRepository: StudentRepository,
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(
    id: string,
    campusId: string | undefined,
    currentUser: User,
  ): Promise<Student> {
    this.logger.log(`Archiving student: ${id}`);

    const student = await this.studentRepository.findById(id);
    if (!student) {
      throw new NotFoundException(`Student with ID ${id} not found`);
    }

    if (campusId && student.campusId !== campusId) {
      throw new NotFoundException(
        `Student with ID ${id} not found in this campus`,
      );
    }

    student.archive();

    await this.unitOfWork.run(async (tx) => {
      await tx.updateStudent(student.id, {
        isArchived: true,
        updatedAt: student.updatedAt,
      });

      await tx.recordAudit({
        actorId: currentUser.id,
        action: "ARCHIVE_STUDENT",
        targetType: "student",
        targetId: student.id,
        campusId: student.campusId,
        context: { actorName: currentUser.profile?.fullName ?? null },
        beforeValue: { isArchived: false },
        afterValue: { isArchived: true },
      });
    });

    this.logger.log(`Student archived successfully: ${id}`);
    return student;
  }
}
