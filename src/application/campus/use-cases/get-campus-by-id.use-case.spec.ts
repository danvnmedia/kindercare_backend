import { NotFoundException } from "@nestjs/common";
import { GetCampusByIdUseCase } from "./get-campus-by-id.use-case";
import { CampusRepository } from "../ports/campus.repository";
import { Campus } from "@/domain/campus/entities/campus.entity";

describe("GetCampusByIdUseCase", () => {
  let useCase: GetCampusByIdUseCase;
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

    useCase = new GetCampusByIdUseCase(mockCampusRepository);
  });

  it("should return a campus by id", async () => {
    const campus = Campus.create(
      { name: "Test Campus" },
      "123e4567-e89b-12d3-a456-426614174000",
    );
    mockCampusRepository.findById.mockResolvedValue(campus);

    const result = await useCase.execute(
      "123e4567-e89b-12d3-a456-426614174000",
    );

    expect(result).toBe(campus);
    expect(mockCampusRepository.findById).toHaveBeenCalledWith(
      "123e4567-e89b-12d3-a456-426614174000",
    );
  });

  it("should throw NotFoundException if campus not found", async () => {
    mockCampusRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute("non-existent-id")).rejects.toThrow(
      NotFoundException,
    );
  });
});
