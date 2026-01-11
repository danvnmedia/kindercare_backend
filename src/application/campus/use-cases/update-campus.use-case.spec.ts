import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { UpdateCampusUseCase } from "./update-campus.use-case";
import { CampusRepository } from "../ports/campus.repository";
import { Campus } from "@/domain/campus/entities/campus.entity";

describe("UpdateCampusUseCase", () => {
  let useCase: UpdateCampusUseCase;
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

    useCase = new UpdateCampusUseCase(mockCampusRepository);
  });

  it("should update a campus successfully", async () => {
    const existingCampus = Campus.create(
      { name: "Original Campus" },
      "campus-id",
    );
    mockCampusRepository.findById.mockResolvedValue(existingCampus);
    mockCampusRepository.findByName.mockResolvedValue(null);
    mockCampusRepository.update.mockImplementation(async (campus) => campus);

    const result = await useCase.execute("campus-id", {
      name: "Updated Campus",
      address: "New Address",
    });

    expect(result.name).toBe("Updated Campus");
    expect(result.address).toBe("New Address");
    expect(mockCampusRepository.update).toHaveBeenCalled();
  });

  it("should throw NotFoundException if campus not found", async () => {
    mockCampusRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute("non-existent-id", { name: "New Name" }),
    ).rejects.toThrow(NotFoundException);
  });

  it("should throw ConflictException if new name already exists", async () => {
    const existingCampus = Campus.create(
      { name: "Original Campus" },
      "campus-id",
    );
    const otherCampus = Campus.create(
      { name: "Existing Name" },
      "other-campus-id",
    );

    mockCampusRepository.findById.mockResolvedValue(existingCampus);
    mockCampusRepository.findByName.mockResolvedValue(otherCampus);

    await expect(
      useCase.execute("campus-id", { name: "Existing Name" }),
    ).rejects.toThrow(ConflictException);
  });

  it("should allow same name if it belongs to the same campus", async () => {
    const existingCampus = Campus.create({ name: "Same Campus" }, "campus-id");

    mockCampusRepository.findById.mockResolvedValue(existingCampus);
    mockCampusRepository.findByName.mockResolvedValue(existingCampus);
    mockCampusRepository.update.mockImplementation(async (campus) => campus);

    const result = await useCase.execute("campus-id", {
      name: "Same Campus",
      address: "Updated Address",
    });

    expect(result.address).toBe("Updated Address");
  });

  it("should update isActive status", async () => {
    const existingCampus = Campus.create(
      { name: "Test Campus", isActive: true },
      "campus-id",
    );

    mockCampusRepository.findById.mockResolvedValue(existingCampus);
    mockCampusRepository.update.mockImplementation(async (campus) => campus);

    const result = await useCase.execute("campus-id", { isActive: false });

    expect(result.isActive).toBe(false);
  });

  it("should throw BadRequestException for validation errors", async () => {
    const existingCampus = Campus.create({ name: "Test Campus" }, "campus-id");

    mockCampusRepository.findById.mockResolvedValue(existingCampus);

    await expect(
      useCase.execute("campus-id", { phoneNumber: "invalid" }),
    ).rejects.toThrow(BadRequestException);
  });
});
