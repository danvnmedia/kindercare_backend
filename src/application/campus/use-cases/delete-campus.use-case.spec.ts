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

  it("should archive a campus successfully", async () => {
    const activeCampus = Campus.create(
      { name: "Active Campus", isArchived: false },
      "campus-id",
    );
    mockCampusRepository.findById.mockResolvedValue(activeCampus);
    mockCampusRepository.update.mockImplementation(async (campus) => campus);

    const result = await useCase.execute("campus-id");

    expect(result.isArchived).toBe(true);
    expect(mockCampusRepository.update).toHaveBeenCalled();
  });

  it("should return campus as-is if already archived", async () => {
    const archivedCampus = Campus.create(
      { name: "Archived Campus", isArchived: true },
      "campus-id",
    );
    mockCampusRepository.findById.mockResolvedValue(archivedCampus);

    const result = await useCase.execute("campus-id");

    expect(result.isArchived).toBe(true);
    expect(mockCampusRepository.update).not.toHaveBeenCalled();
  });

  it("should throw NotFoundException if campus not found", async () => {
    mockCampusRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute("non-existent-id")).rejects.toThrow(
      NotFoundException,
    );
  });
});
