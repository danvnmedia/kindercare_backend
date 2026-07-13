import { SchoolYearEnrollmentController } from "./school-year-enrollment.controller";
import { RegisterForSchoolYearUseCase } from "@/application/class-management/use-cases/school-year-enrollment/register-for-school-year.use-case";
import { GetStudentSchoolYearHistoryUseCase } from "@/application/class-management/use-cases/school-year-enrollment/get-student-school-year-history.use-case";
import { CorrectSchoolYearEnrollmentGradeUseCase } from "@/application/class-management/use-cases/school-year-enrollment/correct-school-year-enrollment-grade.use-case";
import { User } from "@/domain/user-management/user.entity";

const stubActor = User.reconstitute(
  {
    clerkUid: "user_controller",
    isActive: true,
    profile: {
      type: "staff",
      id: "actor-1",
      fullName: "Alice Nguyen",
      email: null,
      phoneNumber: null,
      dateOfBirth: null,
      gender: null,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  "actor-1",
);

describe("SchoolYearEnrollmentController", () => {
  let controller: SchoolYearEnrollmentController;
  let registerUseCase: jest.Mocked<RegisterForSchoolYearUseCase>;
  let historyUseCase: jest.Mocked<GetStudentSchoolYearHistoryUseCase>;
  let correctGradeUseCase: jest.Mocked<CorrectSchoolYearEnrollmentGradeUseCase>;

  beforeEach(() => {
    registerUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<RegisterForSchoolYearUseCase>;
    historyUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<GetStudentSchoolYearHistoryUseCase>;
    correctGradeUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<CorrectSchoolYearEnrollmentGradeUseCase>;

    controller = new SchoolYearEnrollmentController(
      registerUseCase,
      historyUseCase,
      correctGradeUseCase,
    );
  });

  it("wires grade correction to the student-keyed use case input", async () => {
    const expectedResult = { id: "sye-1", gradeLevelId: "grade-2" };
    correctGradeUseCase.execute.mockResolvedValue(expectedResult as never);

    const result = await controller.correctGrade(
      "campus-1",
      "student-1",
      "sye-1",
      { gradeLevelId: "grade-2" },
      stubActor,
    );

    expect(result).toBe(expectedResult);
    expect(correctGradeUseCase.execute).toHaveBeenCalledWith(
      {
        id: "sye-1",
        studentId: "student-1",
        campusId: "campus-1",
        gradeLevelId: "grade-2",
      },
      stubActor,
    );
  });
});
