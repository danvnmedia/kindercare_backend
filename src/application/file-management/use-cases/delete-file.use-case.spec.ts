import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";

import { UniqueEntityID } from "@/core/entities/unique-entity-id";
import { File } from "@/domain/file-management/entities/file.entity";
import { FileRepository } from "../ports/file.repository";
import { DeleteFileUseCase } from "./delete-file.use-case";

function createFile(uploadedBy = "owner-1") {
  return File.create(
    {
      key: "files/campus-1/post/file-1-photo.png",
      filename: "photo.png",
      mimeType: "image/png",
      size: 123n,
      uploadedBy,
      campusId: "campus-1",
    },
    "file-1",
  );
}

function createRepository(): jest.Mocked<FileRepository> {
  return {
    create: jest.fn(),
    update: jest.fn(),
    findById: jest.fn(),
    findByIds: jest.fn(),
    delete: jest.fn(),
    findByIdAndCampus: jest.fn(),
    findByCampus: jest.fn(),
    existsByIdAndCampus: jest.fn(),
    findByKey: jest.fn(),
    findCleanupCandidates: jest.fn(),
    transitionStatus: jest.fn(),
    claimStaleForCleanup: jest.fn(),
    completeCleanup: jest.fn(),
    softDeleteIfUnattached: jest.fn(),
  } as jest.Mocked<FileRepository>;
}

describe("DeleteFileUseCase", () => {
  let repository: jest.Mocked<FileRepository>;
  let useCase: DeleteFileUseCase;

  beforeEach(() => {
    repository = createRepository();
    useCase = new DeleteFileUseCase(repository);
  });

  it("allows the uploader to delete an unattached file without elevated authority", async () => {
    repository.findByIdAndCampus.mockResolvedValue(createFile());
    repository.softDeleteIfUnattached.mockResolvedValue("DELETED");

    const result = await useCase.execute({
      fileId: new UniqueEntityID("file-1"),
      campusId: "campus-1",
      deletedBy: "owner-1",
      canDeleteAny: false,
    });

    expect(result.isRight()).toBe(true);
    expect(repository.softDeleteIfUnattached).toHaveBeenCalledWith(
      "file-1",
      "campus-1",
    );
  });

  it("rejects another uploader without file.manage authority", async () => {
    repository.findByIdAndCampus.mockResolvedValue(createFile());

    const result = await useCase.execute({
      fileId: new UniqueEntityID("file-1"),
      campusId: "campus-1",
      deletedBy: "other-user",
      canDeleteAny: false,
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ForbiddenException);
    expect(repository.softDeleteIfUnattached).not.toHaveBeenCalled();
  });

  it("allows file.manage authority to delete another uploader's unattached file", async () => {
    repository.findByIdAndCampus.mockResolvedValue(createFile());
    repository.softDeleteIfUnattached.mockResolvedValue("DELETED");

    const result = await useCase.execute({
      fileId: new UniqueEntityID("file-1"),
      campusId: "campus-1",
      deletedBy: "manager-1",
      canDeleteAny: true,
    });

    expect(result.isRight()).toBe(true);
  });

  it("protects files referenced by post attachments", async () => {
    repository.findByIdAndCampus.mockResolvedValue(createFile());
    repository.softDeleteIfUnattached.mockResolvedValue("ATTACHED");

    const result = await useCase.execute({
      fileId: new UniqueEntityID("file-1"),
      campusId: "campus-1",
      deletedBy: "owner-1",
      canDeleteAny: false,
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ConflictException);
  });

  it("returns not found when the locked file disappears before deletion", async () => {
    repository.findByIdAndCampus.mockResolvedValue(createFile());
    repository.softDeleteIfUnattached.mockResolvedValue("NOT_FOUND");

    const result = await useCase.execute({
      fileId: new UniqueEntityID("file-1"),
      campusId: "campus-1",
      deletedBy: "owner-1",
      canDeleteAny: false,
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(NotFoundException);
  });
});
