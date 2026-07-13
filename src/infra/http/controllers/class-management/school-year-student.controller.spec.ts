import "reflect-metadata";

import {
  STANDARD_RESPONSE_KEY,
  StandardResponseOptions,
} from "@/core/modules/standard-response/decorators/standard-response.decorator";
import { SchoolYearStudentController } from "./school-year-student.controller";
import { GetSchoolYearStudentsUseCase } from "@/application/class-management/use-cases/school-year-enrollment/get-school-year-students.use-case";

describe("SchoolYearStudentController", () => {
  let controller: SchoolYearStudentController;
  let useCase: jest.Mocked<GetSchoolYearStudentsUseCase>;

  beforeEach(() => {
    useCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<GetSchoolYearStudentsUseCase>;
    controller = new SchoolYearStudentController(useCase);
  });

  it("declares documented standard sort and filter fields", () => {
    const metadata = Reflect.getMetadata(
      STANDARD_RESPONSE_KEY,
      SchoolYearStudentController.prototype.getSchoolYearStudents,
    ) as StandardResponseOptions;

    expect(metadata.isPaginated).toBe(true);
    expect(metadata.allowedSortFields).toEqual([
      "enrollmentDate",
      "exitDate",
      "createdAt",
    ]);
    expect(metadata.allowedFilterFields).toEqual([
      "studentId",
      "gradeLevelId",
      "enrollmentDate",
      "exitDate",
      "exitReason",
    ]);
  });

  it("forwards campus, schoolYearId, StandardRequest params, segment, and search", async () => {
    const response = {
      data: [
        {
          id: "sye-1",
          schoolYearEnrollmentId: "sye-1",
          segment: "active",
          classAssignment: null,
        },
      ],
      pagination: {
        count: 1,
        limit: 10,
        offset: 0,
        totalPages: 1,
        currentPage: 1,
        hasNext: false,
        hasPrev: false,
      },
    };
    useCase.execute.mockResolvedValue(
      response as unknown as Awaited<
        ReturnType<GetSchoolYearStudentsUseCase["execute"]>
      >,
    );

    const result = await controller.getSchoolYearStudents(
      "campus-1",
      "year-1",
      { limit: 10, offset: 0, sort: "-enrollmentDate" },
      { segment: "active", search: "linh" },
    );

    expect(useCase.execute).toHaveBeenCalledWith({
      campusId: "campus-1",
      schoolYearId: "year-1",
      params: { limit: 10, offset: 0, sort: "-enrollmentDate" },
      segment: "active",
      search: "linh",
    });
    expect(result.data[0]).not.toHaveProperty("attendance");
  });
});
