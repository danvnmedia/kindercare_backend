import { PrismaService } from "../prisma.service";
import { PrismaHistoricalRecordRepository } from "./prisma-historical-record.repository";

describe("PrismaHistoricalRecordRepository hard-delete protection", () => {
  it("counts every non-redacted history row without excluding cancellations", async () => {
    const enrollment = { count: jest.fn().mockResolvedValue(2) };
    const schoolYearEnrollment = { count: jest.fn().mockResolvedValue(1) };
    const prisma = { enrollment, schoolYearEnrollment } as any;
    const repository = new PrismaHistoricalRecordRepository(
      prisma as PrismaService,
    );

    await expect(
      repository.countRetainedHistoricalRecords("student-1", "campus-1"),
    ).resolves.toBe(3);
    expect(enrollment.count).toHaveBeenCalledWith({
      where: {
        studentId: "student-1",
        redactedAt: null,
        class: { campusId: "campus-1" },
      },
    });
    expect(schoolYearEnrollment.count).toHaveBeenCalledWith({
      where: {
        studentId: "student-1",
        campusId: "campus-1",
        redactedAt: null,
      },
    });
  });
});
