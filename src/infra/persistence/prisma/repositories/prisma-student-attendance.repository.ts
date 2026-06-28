import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { StudentAttendanceRepository } from "@/application/attendance/ports/student-attendance.repository";
import { StudentAttendanceSummary } from "@/domain/attendance/entities/student-attendance-summary.entity";
import { StudentAttendanceLog } from "@/domain/attendance/entities/student-attendance-log.entity";
import { PrismaStudentAttendanceSummaryMapper } from "../mapper/prisma-student-attendance-summary.mapper";
import { PrismaStudentAttendanceLogMapper } from "../mapper/prisma-student-attendance-log.mapper";
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

  private readonly includeWithLogs = {
    student: true,
    class: true,
    logs: {
      orderBy: { timestamp: "asc" as const },
    },
  };

  // ==========================================
  // Summary Methods
  // ==========================================

  async findById(id: string): Promise<StudentAttendanceSummary | null> {
    const prismaSummary = await this.prisma.studentAttendanceSummary.findUnique(
      {
        where: { id },
        include: this.includeRelations,
      },
    );
    return prismaSummary
      ? PrismaStudentAttendanceSummaryMapper.toDomain(prismaSummary)
      : null;
  }

  async findByStudentAndDate(
    studentId: string,
    date: Date,
  ): Promise<StudentAttendanceSummary | null> {
    // Normalize date to start of day for comparison
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const prismaSummary = await this.prisma.studentAttendanceSummary.findUnique(
      {
        where: {
          studentId_date: {
            studentId,
            date: startOfDay,
          },
        },
        include: this.includeRelations,
      },
    );
    return prismaSummary
      ? PrismaStudentAttendanceSummaryMapper.toDomain(prismaSummary)
      : null;
  }

  async findByClassAndDate(
    classId: string,
    date: Date,
  ): Promise<StudentAttendanceSummary[]> {
    // Normalize date to start of day for comparison
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const prismaSummaries = await this.prisma.studentAttendanceSummary.findMany(
      {
        where: {
          classId,
          date: startOfDay,
        },
        include: this.includeRelations,
        orderBy: { createdAt: "asc" },
      },
    );
    return PrismaStudentAttendanceSummaryMapper.toDomainArray(prismaSummaries);
  }

  async findByStudentDateRange(
    studentId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<StudentAttendanceSummary[]> {
    // Normalize dates
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const prismaSummaries = await this.prisma.studentAttendanceSummary.findMany(
      {
        where: {
          studentId,
          date: {
            gte: start,
            lte: end,
          },
        },
        include: this.includeRelations,
        orderBy: { date: "asc" },
      },
    );
    return PrismaStudentAttendanceSummaryMapper.toDomainArray(prismaSummaries);
  }

  async findByCampus(
    campusId: string,
    params: StandardRequest,
  ): Promise<PaginatedResult<StudentAttendanceSummary>> {
    params.allowedFilterFields = ["studentId", "classId", "date", "status"];
    params.allowedSortFields = ["createdAt", "updatedAt", "date", "status"];

    return await this.queryService.executeQuery<StudentAttendanceSummary>(
      this.prisma,
      "studentAttendanceSummary",
      params,
      {
        where: { campusId },
        include: this.includeRelations,
      },
      PrismaStudentAttendanceSummaryMapper,
    );
  }

  async findAll(
    params: StandardRequest,
  ): Promise<PaginatedResult<StudentAttendanceSummary>> {
    params.allowedFilterFields = [
      "studentId",
      "classId",
      "campusId",
      "date",
      "status",
    ];
    params.allowedSortFields = ["createdAt", "updatedAt", "date", "status"];

    return await this.queryService.executeQuery<StudentAttendanceSummary>(
      this.prisma,
      "studentAttendanceSummary",
      params,
      {
        include: this.includeRelations,
      },
      PrismaStudentAttendanceSummaryMapper,
    );
  }

  async save(
    summary: StudentAttendanceSummary,
  ): Promise<StudentAttendanceSummary> {
    const prismaData = PrismaStudentAttendanceSummaryMapper.toPrisma(summary);
    const created = await this.prisma.studentAttendanceSummary.create({
      data: prismaData,
      include: this.includeRelations,
    });
    return PrismaStudentAttendanceSummaryMapper.toDomain(created);
  }

  async saveMany(
    summaries: StudentAttendanceSummary[],
  ): Promise<StudentAttendanceSummary[]> {
    const results: StudentAttendanceSummary[] = [];

    // Use transaction for bulk insert
    await this.prisma.$transaction(async (tx) => {
      for (const summary of summaries) {
        const prismaData =
          PrismaStudentAttendanceSummaryMapper.toPrisma(summary);
        const created = await tx.studentAttendanceSummary.create({
          data: prismaData,
          include: this.includeRelations,
        });
        results.push(PrismaStudentAttendanceSummaryMapper.toDomain(created));
      }
    });

    return results;
  }

  async update(
    summary: StudentAttendanceSummary,
  ): Promise<StudentAttendanceSummary> {
    const prismaData =
      PrismaStudentAttendanceSummaryMapper.toPrismaUpdate(summary);
    const updated = await this.prisma.studentAttendanceSummary.update({
      where: { id: summary.id },
      data: prismaData,
      include: this.includeRelations,
    });
    return PrismaStudentAttendanceSummaryMapper.toDomain(updated);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.studentAttendanceSummary.delete({
      where: { id },
    });
  }

  async deleteByStudentId(studentId: string): Promise<void> {
    await this.prisma.studentAttendanceSummary.deleteMany({
      where: { studentId },
    });
  }

  // ==========================================
  // Log Methods
  // ==========================================

  async findLogsBySummaryId(
    summaryId: string,
  ): Promise<StudentAttendanceLog[]> {
    const prismaLogs = await this.prisma.studentAttendanceLog.findMany({
      where: { attendanceSummaryId: summaryId },
      orderBy: { timestamp: "asc" },
    });
    return PrismaStudentAttendanceLogMapper.toDomainArray(prismaLogs);
  }

  async saveLog(log: StudentAttendanceLog): Promise<StudentAttendanceLog> {
    const prismaData = PrismaStudentAttendanceLogMapper.toPrisma(log);
    const created = await this.prisma.studentAttendanceLog.create({
      data: prismaData,
    });
    return PrismaStudentAttendanceLogMapper.toDomain(created);
  }

  async saveLogs(
    logs: StudentAttendanceLog[],
  ): Promise<StudentAttendanceLog[]> {
    const results: StudentAttendanceLog[] = [];

    await this.prisma.$transaction(async (tx) => {
      for (const log of logs) {
        const prismaData = PrismaStudentAttendanceLogMapper.toPrisma(log);
        const created = await tx.studentAttendanceLog.create({
          data: prismaData,
        });
        results.push(PrismaStudentAttendanceLogMapper.toDomain(created));
      }
    });

    return results;
  }

  async deleteLogsBySummaryId(summaryId: string): Promise<void> {
    await this.prisma.studentAttendanceLog.deleteMany({
      where: { attendanceSummaryId: summaryId },
    });
  }

  // ==========================================
  // Combined Operations (Transaction)
  // ==========================================

  async saveSummaryWithLog(
    summary: StudentAttendanceSummary,
    log: StudentAttendanceLog,
  ): Promise<{ summary: StudentAttendanceSummary; log: StudentAttendanceLog }> {
    const result = await this.prisma.$transaction(async (tx) => {
      // Create summary first
      const summaryData =
        PrismaStudentAttendanceSummaryMapper.toPrisma(summary);
      const createdSummary = await tx.studentAttendanceSummary.create({
        data: summaryData,
        include: this.includeRelations,
      });

      // Create log with actual summary ID
      const logData = PrismaStudentAttendanceLogMapper.toPrisma(log);
      logData.attendanceSummaryId = createdSummary.id;
      const createdLog = await tx.studentAttendanceLog.create({
        data: logData,
      });

      return {
        summary: PrismaStudentAttendanceSummaryMapper.toDomain(createdSummary),
        log: PrismaStudentAttendanceLogMapper.toDomain(createdLog),
      };
    });

    return result;
  }

  async saveManySummariesWithLogs(
    data: Array<{
      summary: StudentAttendanceSummary;
      log: StudentAttendanceLog;
    }>,
  ): Promise<
    Array<{ summary: StudentAttendanceSummary; log: StudentAttendanceLog }>
  > {
    const results: Array<{
      summary: StudentAttendanceSummary;
      log: StudentAttendanceLog;
    }> = [];

    await this.prisma.$transaction(async (tx) => {
      for (const item of data) {
        // Create summary
        const summaryData = PrismaStudentAttendanceSummaryMapper.toPrisma(
          item.summary,
        );
        const createdSummary = await tx.studentAttendanceSummary.create({
          data: summaryData,
          include: this.includeRelations,
        });

        // Create log with actual summary ID
        const logData = PrismaStudentAttendanceLogMapper.toPrisma(item.log);
        logData.attendanceSummaryId = createdSummary.id;
        const createdLog = await tx.studentAttendanceLog.create({
          data: logData,
        });

        results.push({
          summary:
            PrismaStudentAttendanceSummaryMapper.toDomain(createdSummary),
          log: PrismaStudentAttendanceLogMapper.toDomain(createdLog),
        });
      }
    });

    return results;
  }
}
