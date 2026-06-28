import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { Student } from "@/domain/user-management/entities/student.entity";
import { User } from "@/domain/user-management/user.entity";
import { UnitOfWorkPort } from "@/application/ports/unit-of-work.port";
import { StudentRepository } from "../../ports/student.repository";

/**
 * Restore Student Use Case
 *
 * Flips `isArchived=false` inside a UoW so the `RESTORE_STUDENT` audit row
 * lands in the same transaction (D4 of @doc/specs/admin-audit-log).
 */
@Injectable()
export class RestoreStudentUseCase {
  private readonly logger = new Logger(RestoreStudentUseCase.name);

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
    this.logger.log(`Restoring student: ${id}`);

    const student = await this.studentRepository.findById(id);
    if (!student) {
      throw new NotFoundException(`Student with ID ${id} not found`);
    }

    if (campusId && student.campusId !== campusId) {
      throw new NotFoundException(
        `Student with ID ${id} not found in this campus`,
      );
    }

    if (!student.isArchived) {
      throw new BadRequestException(`Student with ID ${id} is not archived`);
    }

    student.restore();

    await this.unitOfWork.run(async (tx) => {
      await tx.updateStudent(student.id, {
        isArchived: false,
        updatedAt: student.updatedAt,
      });

      await tx.recordAudit({
        actorId: currentUser.id,
        action: "RESTORE_STUDENT",
        targetType: "student",
        targetId: student.id,
        campusId: student.campusId,
        context: { actorName: currentUser.profile?.fullName ?? null },
        beforeValue: { isArchived: true },
        afterValue: { isArchived: false },
      });
    });

    this.logger.log(`Student restored successfully: ${id}`);
    return student;
  }
}
