import { BadRequestException, NotFoundException } from "@nestjs/common";
import { UploadFileUseCase } from "./upload-file.use-case";
import { FileRepository } from "../ports/file.repository";
import { StorageService } from "../ports/storage.service";
import { FilePurpose } from "@/domain/file-management/enums/file-purpose.enum";
import { FileAudienceType } from "@/domain/file-management/enums/file-audience-type.enum";
import { FileStatus } from "@/domain/file-management/enums/file-status.enum";

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

describe("UploadFileUseCase", () => {
  let fileRepository: jest.Mocked<FileRepository>;
  let storageService: jest.Mocked<StorageService>;
  let useCase: UploadFileUseCase;
  let classRepository: { findById: jest.Mock };

  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.CLOUDFLARE_ACCOUNT_ID;
    delete process.env.CLOUDFLARE_R2_ACCESS_KEY;
    delete process.env.CLOUDFLARE_R2_SECRET_KEY;
    delete process.env.CLOUDFLARE_R2_BUCKET;
    fileRepository = createFileRepositoryMock();
    storageService = createStorageServiceMock();
    classRepository = { findById: jest.fn() };
    useCase = new UploadFileUseCase(
      fileRepository,
      storageService,
      classRepository as any,
    );
    fileRepository.create.mockImplementation(async (file) => file);
    fileRepository.update.mockImplementation(async (file) => file);
    storageService.getUploadSignedUrl.mockResolvedValue(
      "https://upload.example.test",
    );
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("creates a pending file and returns a presigned URL", async () => {
    const result = await useCase.execute({
      filename: "photo.png",
      mimeType: "image/png",
      size: 123,
      uploadedBy: "user-1",
      campusId: "campus-1",
      purpose: FilePurpose.POST_ATTACHMENT,
      audienceType: FileAudienceType.ALL,
    });

    expect(result.isRight()).toBe(true);
    expect(fileRepository.create).toHaveBeenCalledTimes(1);
    const createdFile = fileRepository.create.mock.calls[0][0];
    expect(createdFile.status).toBe(FileStatus.PENDING);
    expect(createdFile.storageProvider).toBe("LOCAL");
    expect(createdFile.bucket).toBeNull();
    expect(createdFile.key).toMatch(
      /^files\/campus-1\/attachment\/.+-photo\.png$/,
    );
    expect(storageService.getUploadSignedUrl).toHaveBeenCalledWith(
      createdFile.key,
      "image/png",
    );
  });

  it("stores R2 provider metadata when full R2 env is configured", async () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = "account";
    process.env.CLOUDFLARE_R2_ACCESS_KEY = "access";
    process.env.CLOUDFLARE_R2_SECRET_KEY = "secret";
    process.env.CLOUDFLARE_R2_BUCKET = "bucket";

    const result = await useCase.execute({
      filename: "photo.png",
      mimeType: "image/png",
      size: 123,
      uploadedBy: "user-1",
      campusId: "campus-1",
    });

    expect(result.isRight()).toBe(true);
    const createdFile = fileRepository.create.mock.calls[0][0];
    expect(createdFile.storageProvider).toBe("R2");
    expect(createdFile.bucket).toBe("bucket");
  });

  it("derives audience storage paths and relation IDs", async () => {
    classRepository.findById.mockResolvedValue({ campusId: "campus-1" });

    await useCase.execute({
      filename: "class photo.png",
      mimeType: "image/png",
      size: 123,
      uploadedBy: "user-1",
      campusId: "campus-1",
      purpose: FilePurpose.GENERAL,
      audienceType: FileAudienceType.CLASS,
      audienceId: "class-1",
    });

    const createdFile = fileRepository.create.mock.calls[0][0];
    expect(createdFile.key).toMatch(
      /^files\/campus-1\/class\/class-1\/.+-class-photo\.png$/,
    );
    expect(createdFile.classId).toBe("class-1");
    expect(createdFile.gradeLevelId).toBeNull();
  });

  it("rejects uploads without campus ID", async () => {
    const result = await useCase.execute({
      filename: "photo.png",
      mimeType: "image/png",
      size: 123,
      uploadedBy: "user-1",
      campusId: "",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(BadRequestException);
    expect(fileRepository.create).not.toHaveBeenCalled();
  });

  it("rejects scoped uploads without an audience ID", async () => {
    const result = await useCase.execute({
      filename: "photo.png",
      mimeType: "image/png",
      size: 123,
      uploadedBy: "user-1",
      campusId: "campus-1",
      audienceType: FileAudienceType.CLASS,
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(BadRequestException);
    expect(fileRepository.create).not.toHaveBeenCalled();
  });

  it("rejects class audience IDs outside the campus", async () => {
    classRepository.findById.mockResolvedValue({ campusId: "other-campus" });

    const result = await useCase.execute({
      filename: "photo.png",
      mimeType: "image/png",
      size: 123,
      uploadedBy: "user-1",
      campusId: "campus-1",
      audienceType: FileAudienceType.CLASS,
      audienceId: "class-1",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(NotFoundException);
    expect(fileRepository.create).not.toHaveBeenCalled();
  });

  it("rejects unsupported audience types", async () => {
    const result = await useCase.execute({
      filename: "photo.png",
      mimeType: "image/png",
      size: 123,
      uploadedBy: "user-1",
      campusId: "campus-1",
      audienceType: "STUDENT" as FileAudienceType,
      audienceId: "student-1",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(BadRequestException);
    expect(fileRepository.create).not.toHaveBeenCalled();
  });

  it("rejects invalid upload metadata before creating a file", async () => {
    const result = await useCase.execute({
      filename: "bad.svg",
      mimeType: "image/svg+xml",
      size: 123,
      uploadedBy: "user-1",
      campusId: "campus-1",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(BadRequestException);
    expect(fileRepository.create).not.toHaveBeenCalled();
    expect(storageService.getUploadSignedUrl).not.toHaveBeenCalled();
  });

  it("marks the file ERROR when presigning fails", async () => {
    storageService.getUploadSignedUrl.mockRejectedValue(
      new Error("sign failed"),
    );

    const result = await useCase.execute({
      filename: "photo.png",
      mimeType: "image/png",
      size: 123,
      uploadedBy: "user-1",
      campusId: "campus-1",
    });

    expect(result.isLeft()).toBe(true);
    const createdFile = fileRepository.create.mock.calls[0][0];
    expect(createdFile.status).toBe(FileStatus.ERROR);
    expect(fileRepository.update).toHaveBeenCalledWith(createdFile);
  });
});
