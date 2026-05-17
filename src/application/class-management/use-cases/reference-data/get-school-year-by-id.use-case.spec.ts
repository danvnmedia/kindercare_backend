import { NotFoundException } from "@nestjs/common";
import { GetSchoolYearByIdUseCase } from "./get-school-year-by-id.use-case";
import { SchoolYearRepository } from "../../ports/school-year.repository";
import {
  createSchoolYear,
  createMockSchoolYearRepository,
  DEFAULT_CAMPUS_ID_A,
  DEFAULT_CAMPUS_ID_B,
} from "@/test-utils";

describe("GetSchoolYearByIdUseCase", () => {
  let useCase: GetSchoolYearByIdUseCase;
  let mockSchoolYearRepository: jest.Mocked<SchoolYearRepository>;

  const campusA = DEFAULT_CAMPUS_ID_A;
  const campusB = DEFAULT_CAMPUS_ID_B;

  beforeEach(() => {
    mockSchoolYearRepository = createMockSchoolYearRepository();
    useCase = new GetSchoolYearByIdUseCase(mockSchoolYearRepository);
  });

  it("returns the school year when it belongs to the caller's campus", async () => {
    const schoolYear = createSchoolYear({
      id: "school-year-1",
      campusId: campusA,
      name: "2025-2026",
      startDate: new Date("2025-09-01"),
      endDate: new Date("2026-06-30"),
    });
    mockSchoolYearRepository.findById.mockResolvedValue(schoolYear);

    const result = await useCase.execute("school-year-1", campusA);

    expect(result).toBe(schoolYear);
    expect(result.id).toBe("school-year-1");
    expect(result.campusId).toBe(campusA);
    expect(result.name).toBe("2025-2026");
    expect(mockSchoolYearRepository.findById).toHaveBeenCalledWith(
      "school-year-1",
    );
  });

  it("throws NotFoundException when the school year does not exist", async () => {
    mockSchoolYearRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute("non-existent-id", campusA),
    ).rejects.toThrow(NotFoundException);
    await expect(
      useCase.execute("non-existent-id", campusA),
    ).rejects.toThrow("School year with ID non-existent-id not found");
  });

  it("throws NotFoundException when the school year belongs to a different campus", async () => {
    const schoolYear = createSchoolYear({
      id: "school-year-1",
      campusId: campusB,
      name: "2025-2026",
    });
    mockSchoolYearRepository.findById.mockResolvedValue(schoolYear);

    await expect(useCase.execute("school-year-1", campusA)).rejects.toThrow(
      NotFoundException,
    );
    await expect(useCase.execute("school-year-1", campusA)).rejects.toThrow(
      "School year with ID school-year-1 not found in this campus",
    );

    expect(mockSchoolYearRepository.findById).toHaveBeenCalledTimes(2);
    expect(mockSchoolYearRepository.findById).toHaveBeenCalledWith(
      "school-year-1",
    );
  });
});
