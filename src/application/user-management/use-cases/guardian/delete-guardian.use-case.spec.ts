import { NotFoundException } from "@nestjs/common";

import { DeleteGuardianUseCase } from "./delete-guardian.use-case";
import { GuardianRepository } from "../../ports/guardian.repository";
import { createGuardian, createMockGuardianRepository } from "@/test-utils";

describe("DeleteGuardianUseCase", () => {
  let guardianRepo: jest.Mocked<GuardianRepository>;
  let useCase: DeleteGuardianUseCase;

  beforeEach(() => {
    guardianRepo = createMockGuardianRepository();
    useCase = new DeleteGuardianUseCase(guardianRepo);
  });

  it("hard-deletes only the linked Guardian profile and has no identity or sibling-profile collaborators", async () => {
    const guardian = createGuardian({
      id: "guardian-1",
      campusId: "campus-1",
      userId: "user-shared",
    });
    guardianRepo.findById.mockResolvedValue(guardian);

    await useCase.execute("guardian-1", "campus-1");

    expect(guardianRepo.delete).toHaveBeenCalledTimes(1);
    expect(guardianRepo.delete).toHaveBeenCalledWith("guardian-1");
    // Reintroducing UserRepository, IdentityPort, or sibling-profile
    // repositories changes this constructor shape and breaks this regression.
    expect(DeleteGuardianUseCase.length).toBe(1);
  });

  it("does not delete when the Guardian belongs to another campus", async () => {
    const guardian = createGuardian({
      id: "guardian-1",
      campusId: "campus-2",
      userId: "user-shared",
    });
    guardianRepo.findById.mockResolvedValue(guardian);

    await expect(useCase.execute("guardian-1", "campus-1")).rejects.toThrow(
      NotFoundException,
    );

    expect(guardianRepo.delete).not.toHaveBeenCalled();
  });

  it("throws NotFoundException when the Guardian does not exist", async () => {
    guardianRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute("missing", "campus-1")).rejects.toThrow(
      NotFoundException,
    );

    expect(guardianRepo.delete).not.toHaveBeenCalled();
  });
});
