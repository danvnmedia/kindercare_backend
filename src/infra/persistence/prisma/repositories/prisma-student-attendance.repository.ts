import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { StudentAttendanceRepository } from "@/application/attendance/ports/student-attendance.repository";
import { StudentAttendance } from "@/domain/attendance/entities/student-attendance.entity";
import { PrismaStudentAttendanceMapper } from "../mapper/prisma-student-attendance.mapper";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";
import { PrismaQueryService } from "@/core/modules/standard-response/services/prisma-query.service";

@Injectable()
export class PrismaStudentAttendanceRepository
  implements StudentAttendanceRepository
{
  constructor(
    private readonly prisma: PrismaService,
    private readonly queryService: PrismaQueryService,
  ) {}

  private readonly includeRelations = {
    student: true,
    class: true,
  };

  async findById(id: string): Promise<StudentAttendance | null> {
    const prismaAttendance = await this.prisma.studentAttendance.findUnique({
      where: { id },
      include: this.includeRelations,
    });
    return prismaAttendance
      ? PrismaStudentAttendanceMapper.toDomain(prismaAttendance)
      : null;
  }

  async findByStudentAndDate(
    studentId: string,
    date: Date,
  ): Promise<StudentAttendance | null> {
    // Normalize date to start of day for comparison
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const prismaAttendance = await this.prisma.studentAttendance.findUnique({
      where: {
        studentId_date: {
          studentId,
          date: startOfDay,
        },
      },
      include: this.includeRelations,
    });
    return prismaAttendance
      ? PrismaStudentAttendanceMapper.toDomain(prismaAttendance)
      : null;
  }

  async findByClassAndDate(
    classId: string,
    date: Date,
  ): Promise<StudentAttendance[]> {
    // Normalize date to start of day for comparison
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const prismaAttendances = await this.prisma.studentAttendance.findMany({
      where: {
        classId,
        date: startOfDay,
      },
      include: this.includeRelations,
      orderBy: { createdAt: "asc" },
    });
    return PrismaStudentAttendanceMapper.toDomainArray(prismaAttendances);
  }

  async findByStudentDateRange(
    studentId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<StudentAttendance[]> {
    // Normalize dates
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const prismaAttendances = await this.prisma.studentAttendance.findMany({
      where: {
        studentId,
        date: {
          gte: start,
          lte: end,
        },
      },
      include: this.includeRelations,
      orderBy: { date: "asc" },
    });
    return PrismaStudentAttendanceMapper.toDomainArray(prismaAttendances);
  }

  async findByCampus(
    campusId: string,
    params: StandardRequest,
  ): Promise<PaginatedResult<StudentAttendance>> {
    params.allowedFilterFields = ["studentId", "classId", "date", "status"];
    params.allowedSortFields = ["createdAt", "updatedAt", "date", "status"];

    return await this.queryService.executeQuery<StudentAttendance>(
      this.prisma,
      "studentAttendance",
      params,
      {
        where: { campusId },
        include: this.includeRelations,
      },
      PrismaStudentAttendanceMapper,
    );
  }

  async findAll(
    params: StandardRequest,
  ): Promise<PaginatedResult<StudentAttendance>> {
    params.allowedFilterFields = [
      "studentId",
      "classId",
      "campusId",
      "date",
      "status",
    ];
    params.allowedSortFields = ["createdAt", "updatedAt", "date", "status"];

    return await this.queryService.executeQuery<StudentAttendance>(
      this.prisma,
      "studentAttendance",
      params,
      {
        include: this.includeRelations,
      },
      PrismaStudentAttendanceMapper,
    );
  }

  async save(attendance: StudentAttendance): Promise<StudentAttendance> {
    const prismaData = PrismaStudentAttendanceMapper.toPrisma(attendance);
    const created = await this.prisma.studentAttendance.create({
      data: prismaData,
      include: this.includeRelations,
    });
    return PrismaStudentAttendanceMapper.toDomain(created);
  }

  async saveMany(
    attendances: StudentAttendance[],
  ): Promise<StudentAttendance[]> {
    const results: StudentAttendance[] = [];

    // Use transaction for bulk insert
    await this.prisma.$transaction(async (tx) => {
      for (const attendance of attendances) {
        const prismaData = PrismaStudentAttendanceMapper.toPrisma(attendance);
        const created = await tx.studentAttendance.create({
          data: prismaData,
          include: this.includeRelations,
        });
        results.push(PrismaStudentAttendanceMapper.toDomain(created));
      }
    });

    return results;
  }

  async update(attendance: StudentAttendance): Promise<StudentAttendance> {
    const prismaData = PrismaStudentAttendanceMapper.toPrismaUpdate(attendance);
    const updated = await this.prisma.studentAttendance.update({
      where: { id: attendance.id },
      data: prismaData,
      include: this.includeRelations,
    });
    return PrismaStudentAttendanceMapper.toDomain(updated);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.studentAttendance.delete({
      where: { id },
    });
  }

  async deleteByStudentId(studentId: string): Promise<void> {
    await this.prisma.studentAttendance.deleteMany({
      where: { studentId },
    });
  }
}
