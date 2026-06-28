import { ConflictException, BadRequestException } from "@nestjs/common";
import { CreateCampusUseCase } from "./create-campus.use-case";
import { CampusRepository } from "../ports/campus.repository";
import { Campus } from "@/domain/campus/entities/campus.entity";

describe("CreateCampusUseCase", () => {
  let useCase: CreateCampusUseCase;
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

    useCase = new CreateCampusUseCase(mockCampusRepository);
  });

  it("should create a campus successfully", async () => {
    mockCampusRepository.findByName.mockResolvedValue(null);
    mockCampusRepository.save.mockImplementation(async (campus) => campus);

    const result = await useCase.execute({
      name: "Main Campus",
      address: "123 Main Street",
      phoneNumber: "+84901234567",
    });

    expect(result.name).toBe("Main Campus");
    expect(result.address).toBe("123 Main Street");
    expect(result.phoneNumber).toBe("+84901234567");
    expect(result.isArchived).toBe(false);
    expect(mockCampusRepository.findByName).toHaveBeenCalledWith("Main Campus");
    expect(mockCampusRepository.save).toHaveBeenCalled();
  });

  it("should create a campus with default isArchived false", async () => {
    mockCampusRepository.findByName.mockResolvedValue(null);
    mockCampusRepository.save.mockImplementation(async (campus) => campus);

    const result = await useCase.execute({
      name: "Test Campus",
    });

    expect(result.isArchived).toBe(false);
  });

  it("should create a campus with custom isArchived value", async () => {
    mockCampusRepository.findByName.mockResolvedValue(null);
    mockCampusRepository.save.mockImplementation(async (campus) => campus);

    const result = await useCase.execute({
      name: "Archived Campus",
      isArchived: true,
    });

    expect(result.isArchived).toBe(true);
  });

  it("should throw ConflictException if campus name already exists", async () => {
    const existingCampus = Campus.create({ name: "Existing Campus" });
    mockCampusRepository.findByName.mockResolvedValue(existingCampus);

    await expect(useCase.execute({ name: "Existing Campus" })).rejects.toThrow(
      ConflictException,
    );

    expect(mockCampusRepository.save).not.toHaveBeenCalled();
  });

  it("should throw BadRequestException for validation errors", async () => {
    mockCampusRepository.findByName.mockResolvedValue(null);

    await expect(useCase.execute({ name: "" })).rejects.toThrow(
      BadRequestException,
    );
  });

  it("should handle null address and phoneNumber", async () => {
    mockCampusRepository.findByName.mockResolvedValue(null);
    mockCampusRepository.save.mockImplementation(async (campus) => campus);

    const result = await useCase.execute({
      name: "Minimal Campus",
    });

    expect(result.address).toBeNull();
    expect(result.phoneNumber).toBeNull();
  });
});
