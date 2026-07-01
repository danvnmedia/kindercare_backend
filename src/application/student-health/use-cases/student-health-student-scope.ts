import { StudentRepository } from "@/application/user-management/ports/student.repository";
import { Student } from "@/domain/user-management/entities/student.entity";
import { BadRequestException, NotFoundException } from "@nestjs/common";

export async function getStudentInCampusOrThrow(
  studentRepository: StudentRepository,
  campusId: string,
  studentId: string,
): Promise<Student> {
  const student = await studentRepository.findById(studentId);

  if (!student || student.campusId !== campusId) {
    throw new NotFoundException("Student not found in this campus");
  }

  return student;
}

export function assertStudentWritable(student: Student): void {
  if (student.isArchived) {
    throw new BadRequestException("Archived students cannot be mutated");
  }
}
