import { BulkRecordAttendanceUseCase } from "./bulk-record-attendance.use-case";
import { StudentAttendanceRepository } from "../ports/student-attendance.repository";
import { AttendanceStatus } from "@/domain/attendance/enums/attendance-status.enum";
import {
  createClass,
  createStudent,
  createMockClassRepository,
  createMockStudentRepository,
  DEFAULT_CAMPUS_ID_A,
} from "@/test-utils";

describe("BulkRecordAttendanceUseCase", () => {
  const campusId = DEFAULT_CAMPUS_ID_A;

  const createMockAttendanceRepository =
    (): jest.Mocked<StudentAttendanceRepository> =>
      ({
        findByStudentAndDate: jest.fn(),
        saveManySummariesWithLogs: jest.fn(),
      }) as unknown as jest.Mocked<StudentAttendanceRepository>;

  it("skips duplicate student IDs in request payload and processes unique students once", async () => {
    const mockAttendanceRepository = createMockAttendanceRepository();
    const mockClassRepository = createMockClassRepository();
    const mockStudentRepository = createMockStudentRepository();

    const useCase = new BulkRecordAttendanceUseCase(
      mockAttendanceRepository,
      mockClassRepository,
      mockStudentRepository,
    );

    mockClassRepository.findById.mockResolvedValue(
      createClass({ id: "class-1", campusId }),
    );

    mockStudentRepository.findByIds.mockResolvedValue([
      createStudent({ id: "student-1", campusId }),
    ]);

    mockAttendanceRepository.findByStudentAndDate.mockResolvedValue(null);
    mockAttendanceRepository.saveManySummariesWithLogs.mockImplementation(
      async (data) => data,
    );

    const result = await useCase.execute({
      campusId,
      classId: "class-1",
      date: new Date("2026-02-12T00:00:00.000Z"),
      records: [
        {
          studentId: "student-1",
          status: AttendanceStatus.PRESENT,
          note: "First record",
        },
        {
          studentId: "student-1",
          status: AttendanceStatus.ABSENT,
          note: "Duplicate record",
        },
      ],
    });

    expect(mockStudentRepository.findByIds).toHaveBeenCalledWith(["student-1"]);
    expect(mockAttendanceRepository.findByStudentAndDate).toHaveBeenCalledTimes(
      1,
    );
    expect(
      mockAttendanceRepository.saveManySummariesWithLogs,
    ).toHaveBeenCalledTimes(1);
    expect(
      mockAttendanceRepository.saveManySummariesWithLogs.mock.calls[0][0],
    ).toHaveLength(1);

    expect(result.created).toHaveLength(1);
    expect(result.skipped).toContainEqual({
      studentId: "student-1",
      reason: "Duplicate student in request payload",
    });
  });
});
