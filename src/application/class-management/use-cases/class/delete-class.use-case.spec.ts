import { ConflictException, NotFoundException } from "@nestjs/common";

import {
  ClassDeletionConflictError,
  ClassRepository,
} from "../../ports/class.repository";
import {
  createClass,
  createMockClassRepository,
  DEFAULT_CAMPUS_ID_A,
} from "@/test-utils";
import { DeleteClassUseCase } from "./delete-class.use-case";

describe("DeleteClassUseCase", () => {
  let repository: jest.Mocked<ClassRepository>;
  let useCase: DeleteClassUseCase;

  beforeEach(() => {
    repository = createMockClassRepository();
    useCase = new DeleteClassUseCase(repository);
  });

  it("deletes an unreferenced class in the requested campus", async () => {
    repository.findById.mockResolvedValue(
      createClass({ id: "class-1", campusId: DEFAULT_CAMPUS_ID_A }),
    );
    repository.delete.mockResolvedValue(undefined);

    await expect(
      useCase.execute("class-1", DEFAULT_CAMPUS_ID_A),
    ).resolves.toBeUndefined();
    expect(repository.delete).toHaveBeenCalledWith("class-1");
  });

  it("returns conflict instead of cascading referenced post audiences", async () => {
    repository.findById.mockResolvedValue(
      createClass({ id: "class-1", campusId: DEFAULT_CAMPUS_ID_A }),
    );
    repository.delete.mockRejectedValue(new ClassDeletionConflictError());

    await expect(
      useCase.execute("class-1", DEFAULT_CAMPUS_ID_A),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("hides cross-campus classes", async () => {
    repository.findById.mockResolvedValue(createClass({ id: "class-1" }));

    await expect(
      useCase.execute("class-1", "22222222-2222-4222-a222-222222222222"),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.delete).not.toHaveBeenCalled();
  });
});
