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

const LEASE_TOKEN = new Date("2026-07-01T12:00:00.000Z");

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
    fileRepository.claimStaleForCleanup.mockResolvedValue(LEASE_TOKEN);
    fileRepository.completeCleanup.mockResolvedValue(true);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("marks stale pending files as ERROR and deletes uploaded orphan objects", async () => {
    const staleFile = createFile();
    fileRepository.findCleanupCandidates.mockResolvedValue([staleFile]);
    storageService.getObjectMetadata.mockResolvedValue({
      exists: true,
      contentLength: 123,
      contentType: "image/png",
    });

    const result = await useCase.execute({ olderThanMs: 60_000, limit: 10 });

    expect(fileRepository.findCleanupCandidates).toHaveBeenCalledWith(
      new Date("2026-07-01T11:59:00.000Z"),
      10,
    );
    expect(fileRepository.claimStaleForCleanup).toHaveBeenCalledWith(
      "file-1",
      FileStatus.PENDING,
      new Date("2026-07-01T11:59:00.000Z"),
    );
    expect(storageService.delete).toHaveBeenCalledWith(staleFile.key);
    expect(staleFile.status).toBe(FileStatus.ERROR);
    expect(fileRepository.completeCleanup).toHaveBeenCalledWith(
      "file-1",
      LEASE_TOKEN,
    );
    expect(result).toEqual({
      scanned: 1,
      markedError: 1,
      objectsDeleted: 1,
      objectDeleteFailures: 0,
      cleanupFinalized: 1,
      finalizationConflicts: 0,
      finalizationFailures: 0,
    });
  });

  it("marks stale pending files as ERROR when no object exists", async () => {
    const staleFile = createFile();
    fileRepository.findCleanupCandidates.mockResolvedValue([staleFile]);
    storageService.getObjectMetadata.mockResolvedValue({ exists: false });

    const result = await useCase.execute();

    expect(storageService.delete).not.toHaveBeenCalled();
    expect(staleFile.status).toBe(FileStatus.ERROR);
    expect(result.objectsDeleted).toBe(0);
    expect(result.markedError).toBe(1);
  });

  it("skips storage deletion when another worker wins the cleanup claim", async () => {
    const staleFile = createFile();
    fileRepository.findCleanupCandidates.mockResolvedValue([staleFile]);
    fileRepository.claimStaleForCleanup.mockResolvedValue(null);

    const result = await useCase.execute();

    expect(storageService.getObjectMetadata).not.toHaveBeenCalled();
    expect(storageService.delete).not.toHaveBeenCalled();
    expect(result).toMatchObject({ scanned: 1, markedError: 0 });
  });

  it("leaves failed deletion eligible for a later retry", async () => {
    const staleFile = createFile();
    fileRepository.findCleanupCandidates.mockResolvedValue([staleFile]);
    storageService.getObjectMetadata.mockResolvedValue({ exists: true });
    storageService.delete.mockRejectedValue(new Error("R2 delete failed"));

    const result = await useCase.execute();

    expect(staleFile.status).toBe(FileStatus.ERROR);
    expect(fileRepository.completeCleanup).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      scanned: 1,
      markedError: 1,
      objectsDeleted: 0,
      objectDeleteFailures: 1,
    });
  });

  it("retries a sufficiently stale ERROR cleanup candidate", async () => {
    const staleFile = createFile({
      status: FileStatus.ERROR,
      updatedAt: new Date("2026-07-01T10:00:00.000Z"),
    });
    fileRepository.findCleanupCandidates.mockResolvedValue([staleFile]);
    storageService.getObjectMetadata.mockResolvedValue({ exists: true });

    const result = await useCase.execute({ olderThanMs: 60_000 });

    expect(fileRepository.claimStaleForCleanup).toHaveBeenCalledWith(
      "file-1",
      FileStatus.ERROR,
      new Date("2026-07-01T11:59:00.000Z"),
    );
    expect(storageService.delete).toHaveBeenCalledWith(staleFile.key);
    expect(fileRepository.completeCleanup).toHaveBeenCalledWith(
      "file-1",
      LEASE_TOKEN,
    );
    expect(result).toMatchObject({
      markedError: 0,
      objectsDeleted: 1,
      cleanupFinalized: 1,
      finalizationConflicts: 0,
    });
  });

  it("records a lost lease without reporting cleanup finalization", async () => {
    const staleFile = createFile({ status: FileStatus.ERROR });
    fileRepository.findCleanupCandidates.mockResolvedValue([staleFile]);
    fileRepository.completeCleanup.mockResolvedValue(false);
    storageService.getObjectMetadata.mockResolvedValue({ exists: true });

    const result = await useCase.execute();

    expect(storageService.delete).toHaveBeenCalledWith(staleFile.key);
    expect(result).toMatchObject({
      objectsDeleted: 1,
      cleanupFinalized: 0,
      finalizationConflicts: 1,
      finalizationFailures: 0,
    });
  });

  it("records finalization persistence failures separately", async () => {
    const staleFile = createFile({ status: FileStatus.ERROR });
    fileRepository.findCleanupCandidates.mockResolvedValue([staleFile]);
    fileRepository.completeCleanup.mockRejectedValue(
      new Error("DB unavailable"),
    );
    storageService.getObjectMetadata.mockResolvedValue({ exists: false });

    const result = await useCase.execute();

    expect(result).toMatchObject({
      objectsDeleted: 0,
      objectDeleteFailures: 0,
      cleanupFinalized: 0,
      finalizationConflicts: 0,
      finalizationFailures: 1,
    });
  });
});
