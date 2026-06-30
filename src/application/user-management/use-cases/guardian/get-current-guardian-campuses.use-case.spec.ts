import { UnauthorizedException } from "@nestjs/common";

import {
  createCampus,
  createRole,
  createUser,
  createUserWithCampusRoles,
  DEFAULT_CAMPUS_ID_A,
} from "@/test-utils/entity-factories";
import { createMockGuardianRepository } from "@/test-utils/mock-repository-factory";

import { GetCurrentGuardianCampusesUseCase } from "./get-current-guardian-campuses.use-case";

describe("GetCurrentGuardianCampusesUseCase", () => {
  it("returns active guardian campuses for the authenticated user", async () => {
    const user = createUser();
    const campuses = [
      createCampus({ id: "11111111-1111-4111-a111-111111111111" }),
      createCampus({ id: "22222222-2222-4222-a222-222222222222" }),
    ];
    const guardianRepository = createMockGuardianRepository();
    guardianRepository.findActiveCampusesByUserId.mockResolvedValue(campuses);
    const useCase = new GetCurrentGuardianCampusesUseCase(guardianRepository);

    await expect(useCase.execute(user)).resolves.toEqual(campuses);
    expect(guardianRepository.findActiveCampusesByUserId).toHaveBeenCalledWith(
      user.id.toString(),
    );
  });

  it("returns an empty list for staff-only users with no guardian campuses", async () => {
    const user = createUserWithCampusRoles(
      "44444444-4444-4444-a444-444444444444",
      [
        {
          role: createRole({ id: "staff-role", name: "Staff" }),
          campusId: DEFAULT_CAMPUS_ID_A,
        },
      ],
    );
    const guardianRepository = createMockGuardianRepository();
    guardianRepository.findActiveCampusesByUserId.mockResolvedValue([]);
    const useCase = new GetCurrentGuardianCampusesUseCase(guardianRepository);

    await expect(useCase.execute(user)).resolves.toEqual([]);
    expect(guardianRepository.findActiveCampusesByUserId).toHaveBeenCalledWith(
      user.id.toString(),
    );
  });

  it("queries guardian campuses by current user for mixed staff and guardian users", async () => {
    const user = createUserWithCampusRoles(
      "55555555-5555-4555-a555-555555555555",
      [
        {
          role: createRole({ id: "admin-role", name: "Campus Admin" }),
          campusId: DEFAULT_CAMPUS_ID_A,
        },
      ],
    );
    const campuses = [
      createCampus({ id: "33333333-3333-4333-a333-333333333333" }),
    ];
    const guardianRepository = createMockGuardianRepository();
    guardianRepository.findActiveCampusesByUserId.mockResolvedValue(campuses);
    const useCase = new GetCurrentGuardianCampusesUseCase(guardianRepository);

    await expect(useCase.execute(user)).resolves.toEqual(campuses);
    expect(guardianRepository.findActiveCampusesByUserId).toHaveBeenCalledWith(
      user.id.toString(),
    );
  });

  it("rejects when no authenticated domain user is available", async () => {
    const guardianRepository = createMockGuardianRepository();
    const useCase = new GetCurrentGuardianCampusesUseCase(guardianRepository);

    await expect(useCase.execute(undefined as never)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(
      guardianRepository.findActiveCampusesByUserId,
    ).not.toHaveBeenCalled();
  });
});
