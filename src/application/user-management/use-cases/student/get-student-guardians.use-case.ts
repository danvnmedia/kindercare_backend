import {
  Injectable,
  Inject,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { StudentRepository } from '../../ports/student.repository';
import { StudentGuardianInfo } from '@/domain/user-management/student.entity';

@Injectable()
export class GetStudentGuardiansUseCase {
  private readonly logger = new Logger(GetStudentGuardiansUseCase.name);

  constructor(
    @Inject('STUDENT_REPOSITORY')
    private readonly studentRepository: StudentRepository,
  ) {}

  async execute(studentId: string): Promise<StudentGuardianInfo[]> {
    try {
      this.logger.log(`Getting guardians for student ${studentId}`);

      // Check student exists
      const student = await this.studentRepository.findById(studentId);
      if (!student) {
        throw new NotFoundException(`Student with ID ${studentId} not found`);
      }

      // Get guardians
      const guardians = await this.studentRepository.getStudentGuardians(studentId);

      this.logger.log(
        `Found ${guardians.length} guardians for student ${studentId}`,
      );

      return guardians;
    } catch (error) {
      this.logger.error(
        `Failed to get student guardians: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
