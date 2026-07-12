import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { UniqueEntityID } from "@/core/entities/unique-entity-id";
import { File } from "@/domain/file-management/entities/file.entity";
import { FileStatus } from "@/domain/file-management/enums/file-status.enum";
import { FileRepository } from "../ports/file.repository";
import { StorageService } from "../ports/storage.service";
import { CompleteUploadUseCase } from "./complete-upload.use-case";

function createFileRepositoryMock(): jest.Mocked<FileRepository> {
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
  } as unknown as jest.Mocked<FileRepository>;
}

function createStorageServiceMock(): jest.Mocked<StorageService> {
  return {
    getUploadSignedUrl: jest.fn(),
    delete: jest.fn(),
    getSignedUrl: jest.fn(),
    getObjectMetadata: jest.fn(),
  } as jest.Mocked<StorageService>;
}

function createFile(
  overrides: Partial<Parameters<typeof File.create>[0]> = {},
) {
  return File.create(
    {
      key: "files/campus-1/attachment/file-1-photo.png",
      filename: "photo.png",
      mimeType: "image/png",
      size: 123n,
      uploadedBy: "user-1",
      campusId: "campus-1",
      ...overrides,
    },
    "file-1",
  );
}

describe("CompleteUploadUseCase", () => {
  let fileRepository: jest.Mocked<FileRepository>;
  let storageService: jest.Mocked<StorageService>;
  let useCase: CompleteUploadUseCase;

  beforeEach(() => {
    fileRepository = createFileRepositoryMock();
    storageService = createStorageServiceMock();
    useCase = new CompleteUploadUseCase(fileRepository, storageService);

    storageService.getObjectMetadata.mockResolvedValue({
      exists: true,
      contentLength: 123,
      contentType: "image/png",
    });
    storageService.getSignedUrl.mockResolvedValue(
      "https://cdn.example.test/photo.png",
    );
  });

  it("marks a pending uploaded object as UPLOADED and returns its URL", async () => {
    const file = createFile();
    fileRepository.findByIdAndCampus.mockResolvedValue(file);
    fileRepository.transitionStatus.mockResolvedValue(true);

    const result = await useCase.execute({
      fileId: new UniqueEntityID("file-1"),
      campusId: "campus-1",
      uploadedBy: "user-1",
    });

    expect(result.isRight()).toBe(true);
    expect(storageService.getObjectMetadata).toHaveBeenCalledWith(file.key);
    expect(file.status).toBe(FileStatus.UPLOADED);
    expect(fileRepository.transitionStatus).toHaveBeenCalledWith(
      "file-1",
      FileStatus.PENDING,
      FileStatus.UPLOADED,
    );
    expect(storageService.getSignedUrl).toHaveBeenCalledWith(file.key);
    expect(result.value).toMatchObject({
      file,
      url: "https://cdn.example.test/photo.png",
    });
  });

  it("returns idempotent success when another completion wins the claim", async () => {
    const pendingFile = createFile();
    const uploadedFile = createFile({ status: FileStatus.UPLOADED });
    fileRepository.findByIdAndCampus
      .mockResolvedValueOnce(pendingFile)
      .mockResolvedValueOnce(uploadedFile);
    fileRepository.transitionStatus.mockResolvedValue(false);

    const result = await useCase.execute({
      fileId: new UniqueEntityID("file-1"),
      campusId: "campus-1",
      uploadedBy: "user-1",
    });

    expect(result.isRight()).toBe(true);
    expect(result.value).toMatchObject({ file: uploadedFile });
    expect(storageService.getSignedUrl).toHaveBeenCalledWith(uploadedFile.key);
  });

  it("returns conflict when stale cleanup wins the claim", async () => {
    const pendingFile = createFile();
    const errorFile = createFile({ status: FileStatus.ERROR });
    fileRepository.findByIdAndCampus
      .mockResolvedValueOnce(pendingFile)
      .mockResolvedValueOnce(errorFile);
    fileRepository.transitionStatus.mockResolvedValue(false);

    const result = await useCase.execute({
      fileId: new UniqueEntityID("file-1"),
      campusId: "campus-1",
      uploadedBy: "user-1",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ConflictException);
    expect(storageService.getSignedUrl).not.toHaveBeenCalled();
  });

  it("rejects completion when file is not found in the campus", async () => {
    fileRepository.findByIdAndCampus.mockResolvedValue(null);

    const result = await useCase.execute({
      fileId: new UniqueEntityID("file-1"),
      campusId: "other-campus",
      uploadedBy: "user-1",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(NotFoundException);
    expect(storageService.getObjectMetadata).not.toHaveBeenCalled();
    expect(fileRepository.update).not.toHaveBeenCalled();
  });

  it("rejects completion by a different uploader", async () => {
    const file = createFile();
    fileRepository.findByIdAndCampus.mockResolvedValue(file);

    const result = await useCase.execute({
      fileId: new UniqueEntityID("file-1"),
      campusId: "campus-1",
      uploadedBy: "user-2",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(ForbiddenException);
    expect(storageService.getObjectMetadata).not.toHaveBeenCalled();
    expect(fileRepository.update).not.toHaveBeenCalled();
  });

  it("returns a fresh URL when completion previously persisted UPLOADED", async () => {
    const file = createFile({ status: FileStatus.UPLOADED });
    fileRepository.findByIdAndCampus.mockResolvedValue(file);

    const result = await useCase.execute({
      fileId: new UniqueEntityID("file-1"),
      campusId: "campus-1",
      uploadedBy: "user-1",
    });

    expect(result.isRight()).toBe(true);
    expect(storageService.getObjectMetadata).not.toHaveBeenCalled();
    expect(fileRepository.transitionStatus).not.toHaveBeenCalled();
    expect(storageService.getSignedUrl).toHaveBeenCalledWith(file.key);
  });

  it("rejects completion when the storage object is missing", async () => {
    const file = createFile();
    fileRepository.findByIdAndCampus.mockResolvedValue(file);
    storageService.getObjectMetadata.mockResolvedValue({ exists: false });

    const result = await useCase.execute({
      fileId: new UniqueEntityID("file-1"),
      campusId: "campus-1",
      uploadedBy: "user-1",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(BadRequestException);
    expect(file.status).toBe(FileStatus.PENDING);
    expect(fileRepository.update).not.toHaveBeenCalled();
  });

  it("rejects completion when storage object size mismatches", async () => {
    const file = createFile();
    fileRepository.findByIdAndCampus.mockResolvedValue(file);
    storageService.getObjectMetadata.mockResolvedValue({
      exists: true,
      contentLength: 456,
      contentType: "image/png",
    });

    const result = await useCase.execute({
      fileId: new UniqueEntityID("file-1"),
      campusId: "campus-1",
      uploadedBy: "user-1",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(BadRequestException);
    expect(file.status).toBe(FileStatus.PENDING);
    expect(fileRepository.update).not.toHaveBeenCalled();
  });

  it("rejects completion when storage object content type mismatches", async () => {
    const file = createFile();
    fileRepository.findByIdAndCampus.mockResolvedValue(file);
    storageService.getObjectMetadata.mockResolvedValue({
      exists: true,
      contentLength: 123,
      contentType: "image/jpeg",
    });

    const result = await useCase.execute({
      fileId: new UniqueEntityID("file-1"),
      campusId: "campus-1",
      uploadedBy: "user-1",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(BadRequestException);
    expect(file.status).toBe(FileStatus.PENDING);
    expect(fileRepository.update).not.toHaveBeenCalled();
  });

  it("does not mark the file UPLOADED when storage metadata lookup fails", async () => {
    const file = createFile();
    fileRepository.findByIdAndCampus.mockResolvedValue(file);
    storageService.getObjectMetadata.mockRejectedValue(
      new Error("R2 unavailable"),
    );

    await expect(
      useCase.execute({
        fileId: new UniqueEntityID("file-1"),
        campusId: "campus-1",
        uploadedBy: "user-1",
      }),
    ).rejects.toThrow("R2 unavailable");

    expect(file.status).toBe(FileStatus.PENDING);
    expect(fileRepository.update).not.toHaveBeenCalled();
  });
});
