import { NotFoundException } from "@nestjs/common";
import { DeleteCampusUseCase } from "./delete-campus.use-case";
import { CampusRepository } from "../ports/campus.repository";
import { Campus } from "@/domain/campus/entities/campus.entity";

describe("DeleteCampusUseCase", () => {
  let useCase: DeleteCampusUseCase;
  let mockCampusRepository: jest.Mocked<CampusRepository>;

  beforeEach(() => {
    mockCampusRepository = {
      findById: jest.fn(),
      findByName: jest.fn(),
      findAll: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      exists: jest.fn(),
    } as jest.Mocked<CampusRepository>;

    useCase = new DeleteCampusUseCase(mockCampusRepository);
  });

  it("should deactivate a campus successfully", async () => {
    const activeCampus = Campus.create(
      { name: "Active Campus", isActive: true },
      "campus-id",
    );
    mockCampusRepository.findById.mockResolvedValue(activeCampus);
    mockCampusRepository.update.mockImplementation(async (campus) => campus);

    const result = await useCase.execute("campus-id");

    expect(result.isActive).toBe(false);
    expect(mockCampusRepository.update).toHaveBeenCalled();
  });

  it("should return campus as-is if already inactive", async () => {
    const inactiveCampus = Campus.create(
      { name: "Inactive Campus", isActive: false },
      "campus-id",
    );
    mockCampusRepository.findById.mockResolvedValue(inactiveCampus);

    const result = await useCase.execute("campus-id");

    expect(result.isActive).toBe(false);
    expect(mockCampusRepository.update).not.toHaveBeenCalled();
  });

  it("should throw NotFoundException if campus not found", async () => {
    mockCampusRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute("non-existent-id")).rejects.toThrow(
      NotFoundException,
    );
  });
});
