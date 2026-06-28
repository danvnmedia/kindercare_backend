import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { StudentAttendanceSummary } from "@/domain/attendance/entities/student-attendance-summary.entity";
import { StudentAttendanceRepository } from "../ports/student-attendance.repository";
import { ClassRepository } from "@/application/class-management/ports/class.repository";

export interface GetClassAttendanceInput {
  campusId: string;
  classId: string;
  date: Date;
}

@Injectable()
export class GetClassAttendanceUseCase {
  private readonly logger = new Logger(GetClassAttendanceUseCase.name);

  constructor(
    @Inject("STUDENT_ATTENDANCE_REPOSITORY")
    private readonly attendanceRepository: StudentAttendanceRepository,
    @Inject("CLASS_REPOSITORY")
    private readonly classRepository: ClassRepository,
  ) {}

  async execute(
    input: GetClassAttendanceInput,
  ): Promise<StudentAttendanceSummary[]> {
    const dateStr = input.date.toISOString().split("T")[0];
    this.logger.log(
      `Getting attendance for class ${input.classId} on ${dateStr}`,
    );

    // Step 1: Validate class exists and belongs to campus
    const classEntity = await this.classRepository.findById(input.classId);
    if (!classEntity) {
      throw new NotFoundException(`Class with ID ${input.classId} not found`);
    }
    if (classEntity.campusId !== input.campusId) {
      throw new BadRequestException(`Class does not belong to this campus`);
    }

    // Step 2: Get attendance summaries
    const summaries = await this.attendanceRepository.findByClassAndDate(
      input.classId,
      input.date,
    );

    this.logger.log(`Found ${summaries.length} attendance records`);
    return summaries;
  }
}
