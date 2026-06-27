import { ForbiddenException } from "@nestjs/common";

import { GetCurrentGuardianStudentsUseCase } from "@/application/absence-request";
import {
  createGuardian,
  createMockGuardianRepository,
  createStudent,
  createUser,
  DEFAULT_CAMPUS_ID_A,
} from "@/test-utils";

describe("GetCurrentGuardianStudentsUseCase", () => {
  it("returns active campus children for the guardian linked to current user", async () => {
    const user = createUser();
    const guardian = createGuardian({ userId: user.id.toString() });
    const student = createStudent();
    const guardianRepository = createMockGuardianRepository();
    guardianRepository.findByUserIdInCampus.mockResolvedValue(guardian);
    guardianRepository.getGuardianChildrenInCampus.mockResolvedValue([
      {
        student,
        guardianRelationship: {
          id: "77777777-7777-4777-a777-777777777777",
          name: "Mother",
        },
      },
    ]);
    const useCase = new GetCurrentGuardianStudentsUseCase(guardianRepository);

    const result = await useCase.execute(DEFAULT_CAMPUS_ID_A, user);

    expect(result).toHaveLength(1);
    expect(result[0].student.id.toString()).toBe(student.id.toString());
    expect(guardianRepository.findByUserIdInCampus).toHaveBeenCalledWith(
      user.id.toString(),
      DEFAULT_CAMPUS_ID_A,
    );
    expect(guardianRepository.getGuardianChildrenInCampus).toHaveBeenCalledWith(
      guardian.id.toString(),
      DEFAULT_CAMPUS_ID_A,
    );
  });

  it("rejects users without an active guardian profile in the selected campus", async () => {
    const user = createUser();
    const guardianRepository = createMockGuardianRepository();
    guardianRepository.findByUserIdInCampus.mockResolvedValue(null);
    const useCase = new GetCurrentGuardianStudentsUseCase(guardianRepository);

    await expect(
      useCase.execute(DEFAULT_CAMPUS_ID_A, user),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(
      guardianRepository.getGuardianChildrenInCampus,
    ).not.toHaveBeenCalled();
  });
});
