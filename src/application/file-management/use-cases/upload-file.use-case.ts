import { UniqueEntityID } from "@/core/entities/unique-entity-id";
import { Either, left, right } from "@/core/types/either";
import { File } from "@/domain/file-management/entities/file.entity";
import { FileRepository } from "../ports/file.repository";
import { StorageService } from "../ports/storage.service";

export interface UploadFileUseCaseRequest {
  filename: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  campusId: string;
  bucket?: string;
  storageProvider?: string;
}

export type UploadFileUseCaseResponse = Either<
  Error,
  { file: File; uploadUrl: string }
>;

export class UploadFileUseCase {
  constructor(
    private fileRepository: FileRepository,
    private storageService: StorageService,
  ) {}

  async execute({
    filename,
    mimeType,
    size,
    uploadedBy,
    campusId,
    bucket,
    storageProvider,
  }: UploadFileUseCaseRequest): Promise<UploadFileUseCaseResponse> {
    // TODO: Add file validation (mime type, size limits) here or in a domain service

    const fileId = new UniqueEntityID().toString();
    const key = `files/${campusId}/${fileId}-${filename}`;

    const file = File.create(
      {
        key,
        filename,
        mimeType,
        size: BigInt(size),
        uploadedBy,
        campusId,
        bucket: bucket ?? process.env.STORAGE_BUCKET ?? null,
        storageProvider: storageProvider ?? "LOCAL",
      },
      fileId,
    );

    let uploadUrl: string;
    try {
      uploadUrl = await this.storageService.getUploadSignedUrl(key, mimeType);
    } catch (error) {
      return left(new Error("Failed to get upload signed URL."));
    }

    const createdFile = await this.fileRepository.create(file);

    return right({ file: createdFile, uploadUrl });
  }
}
