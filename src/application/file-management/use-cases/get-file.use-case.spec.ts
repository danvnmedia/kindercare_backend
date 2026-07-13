import { ForbiddenException } from "@nestjs/common";

import { UniqueEntityID } from "@/core/entities/unique-entity-id";
import { File } from "@/domain/file-management/entities/file.entity";
import { FilePurpose } from "@/domain/file-management/enums/file-purpose.enum";
import { FileStatus } from "@/domain/file-management/enums/file-status.enum";
import { FileRepository } from "../ports/file.repository";
import { StorageService } from "../ports/storage.service";
import { GetFileUseCase } from "./get-file.use-case";

const FILE_ID = "44444444-4444-4444-a444-444444444444";

function postAttachment(): File {
  return File.create(
    {
      key: "files/campus-1/attachment/photo.png",
      filename: "photo.png",
      mimeType: "image/png",
      size: 123n,
      uploadedBy: "uploader-1",
      campusId: "campus-1",
      purpose: FilePurpose.POST_ATTACHMENT,
      status: FileStatus.UPLOADED,
    },
    FILE_ID,
  );
}

describe("GetFileUseCase", () => {
  let repository: jest.Mocked<FileRepository>;
  let storage: jest.Mocked<StorageService>;
  let useCase: GetFileUseCase;

  beforeEach(() => {
    repository = {
      findByIdAndCampus: jest.fn().mockResolvedValue(postAttachment()),
    } as unknown as jest.Mocked<FileRepository>;
    storage = {
      getSignedUrl: jest
        .fn()
        .mockResolvedValue("https://signed.example/photo.png"),
    } as unknown as jest.Mocked<StorageService>;
    useCase = new GetFileUseCase(repository, storage);
  });

  it("lets the uploader read a post attachment directly", async () => {
    const result = await useCase.execute({
      fileId: new UniqueEntityID(FILE_ID),
      campusId: "campus-1",
      requestedBy: "uploader-1",
      canReadAny: false,
    });

    expect(result.isRight()).toBe(true);
    expect(storage.getSignedUrl).toHaveBeenCalledTimes(1);
  });

  it("lets file managers read a post attachment directly", async () => {
    const result = await useCase.execute({
      fileId: new UniqueEntityID(FILE_ID),
      campusId: "campus-1",
      requestedBy: "manager-1",
      canReadAny: true,
    });

    expect(result.isRight()).toBe(true);
  });

  it("blocks other campus users from bypassing post audience authorization", async () => {
    const result = await useCase.execute({
      fileId: new UniqueEntityID(FILE_ID),
      campusId: "campus-1",
      requestedBy: "guardian-1",
      canReadAny: false,
    });

    expect(result.isLeft()).toBe(true);
    if (result.isLeft()) {
      expect(result.value).toBeInstanceOf(ForbiddenException);
    }
    expect(storage.getSignedUrl).not.toHaveBeenCalled();
  });
});
