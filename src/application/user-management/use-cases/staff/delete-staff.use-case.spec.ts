import { NotFoundException } from "@nestjs/common";

import { DeleteStaffUseCase } from "./delete-staff.use-case";
import { StaffRepository } from "../../ports/staff.repository";
import { createMockStaffRepository, createStaff } from "@/test-utils";

describe("DeleteStaffUseCase", () => {
  let staffRepo: jest.Mocked<StaffRepository>;
  let useCase: DeleteStaffUseCase;

  beforeEach(() => {
    staffRepo = createMockStaffRepository();
    useCase = new DeleteStaffUseCase(staffRepo);
  });

  it("hard-deletes only the linked Staff profile and has no identity or sibling-profile collaborators", async () => {
    const staff = createStaff({
      id: "staff-1",
      campusId: "campus-1",
      userId: "user-shared",
    });
    staffRepo.findById.mockResolvedValue(staff);

    await useCase.execute("staff-1", "campus-1");

    expect(staffRepo.delete).toHaveBeenCalledTimes(1);
    expect(staffRepo.delete).toHaveBeenCalledWith("staff-1");
    // Reintroducing UserRepository, IdentityPort, or sibling-profile
    // repositories changes this constructor shape and breaks this regression.
    expect(DeleteStaffUseCase.length).toBe(1);
  });

  it("does not delete when the Staff belongs to another campus", async () => {
    const staff = createStaff({
      id: "staff-1",
      campusId: "campus-2",
      userId: "user-shared",
    });
    staffRepo.findById.mockResolvedValue(staff);

    await expect(useCase.execute("staff-1", "campus-1")).rejects.toThrow(
      NotFoundException,
    );

    expect(staffRepo.delete).not.toHaveBeenCalled();
  });

  it("throws NotFoundException when the Staff does not exist", async () => {
    staffRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute("missing", "campus-1")).rejects.toThrow(
      NotFoundException,
    );

    expect(staffRepo.delete).not.toHaveBeenCalled();
  });
});
