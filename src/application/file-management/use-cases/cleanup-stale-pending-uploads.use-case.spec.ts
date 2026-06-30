import { CleanupStalePendingUploadsUseCase } from "./cleanup-stale-pending-uploads.use-case";
import { FileRepository } from "../ports/file.repository";
import { StorageService } from "../ports/storage.service";
import { File } from "@/domain/file-management/entities/file.entity";
import { FileStatus } from "@/domain/file-management/enums/file-status.enum";

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
    findStalePending: jest.fn(),
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

describe("CleanupStalePendingUploadsUseCase", () => {
  let fileRepository: jest.Mocked<FileRepository>;
  let storageService: jest.Mocked<StorageService>;
  let useCase: CleanupStalePendingUploadsUseCase;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date("2026-07-01T12:00:00.000Z"));
    fileRepository = createFileRepositoryMock();
    storageService = createStorageServiceMock();
    useCase = new CleanupStalePendingUploadsUseCase(
      fileRepository,
      storageService,
    );
    fileRepository.update.mockImplementation(async (file) => file);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("marks stale pending files as ERROR and deletes uploaded orphan objects", async () => {
    const staleFile = createFile();
    fileRepository.findStalePending.mockResolvedValue([staleFile]);
    storageService.getObjectMetadata.mockResolvedValue({
      exists: true,
      contentLength: 123,
      contentType: "image/png",
    });

    const result = await useCase.execute({ olderThanMs: 60_000, limit: 10 });

    expect(fileRepository.findStalePending).toHaveBeenCalledWith(
      new Date("2026-07-01T11:59:00.000Z"),
      10,
    );
    expect(storageService.delete).toHaveBeenCalledWith(staleFile.key);
    expect(fileRepository.update).toHaveBeenCalledWith(staleFile);
    expect(staleFile.status).toBe(FileStatus.ERROR);
    expect(result).toEqual({
      scanned: 1,
      markedError: 1,
      objectsDeleted: 1,
      objectDeleteFailures: 0,
    });
  });

  it("marks stale pending files as ERROR when no object exists", async () => {
    const staleFile = createFile();
    fileRepository.findStalePending.mockResolvedValue([staleFile]);
    storageService.getObjectMetadata.mockResolvedValue({ exists: false });

    const result = await useCase.execute();

    expect(storageService.delete).not.toHaveBeenCalled();
    expect(staleFile.status).toBe(FileStatus.ERROR);
    expect(result.objectsDeleted).toBe(0);
    expect(result.markedError).toBe(1);
  });

  it("continues marking files ERROR if object deletion fails", async () => {
    const staleFile = createFile();
    fileRepository.findStalePending.mockResolvedValue([staleFile]);
    storageService.getObjectMetadata.mockResolvedValue({ exists: true });
    storageService.delete.mockRejectedValue(new Error("R2 delete failed"));

    const result = await useCase.execute();

    expect(staleFile.status).toBe(FileStatus.ERROR);
    expect(fileRepository.update).toHaveBeenCalledWith(staleFile);
    expect(result).toMatchObject({
      scanned: 1,
      markedError: 1,
      objectsDeleted: 0,
      objectDeleteFailures: 1,
    });
  });
});
