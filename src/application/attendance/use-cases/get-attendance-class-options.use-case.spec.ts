import { GetAttendanceClassOptionsUseCase } from "./get-attendance-class-options.use-case";
import { AttendanceClassOptionsRepository } from "@/application/attendance/ports/attendance-class-options.repository";

describe("GetAttendanceClassOptionsUseCase", () => {
  const repository = {
    findAttendanceOptions: jest.fn(),
  } as unknown as jest.Mocked<AttendanceClassOptionsRepository>;
  const useCase = new GetAttendanceClassOptionsUseCase(repository);

  beforeEach(() => jest.clearAllMocks());

  it("forwards campus scope, trimmed search, and pagination", async () => {
    repository.findAttendanceOptions.mockResolvedValue({
      data: [],
      pagination: {
        count: 0,
        limit: 20,
        offset: 40,
        totalPages: 0,
        currentPage: 3,
        hasNext: false,
        hasPrev: true,
      },
    });

    await useCase.execute({
      campusId: "campus-a",
      search: "  Sunflower  ",
      limit: 20,
      offset: 40,
    });

    expect(repository.findAttendanceOptions).toHaveBeenCalledWith("campus-a", {
      search: "Sunflower",
      limit: 20,
      offset: 40,
    });
  });

  it("applies defaults and caps the limit at 100", async () => {
    repository.findAttendanceOptions.mockResolvedValue({
      data: [],
      pagination: {
        count: 0,
        limit: 100,
        offset: 0,
        totalPages: 0,
        currentPage: 1,
        hasNext: false,
        hasPrev: false,
      },
    });

    await useCase.execute({ campusId: "campus-a", limit: 500, offset: -3 });

    expect(repository.findAttendanceOptions).toHaveBeenCalledWith("campus-a", {
      search: undefined,
      limit: 100,
      offset: 0,
    });
  });
});
