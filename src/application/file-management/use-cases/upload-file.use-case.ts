import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { UniqueEntityID } from "@/core/entities/unique-entity-id";
import { Either, left, right } from "@/core/types/either";
import { File } from "@/domain/file-management/entities/file.entity";
import { FilePurpose } from "@/domain/file-management/enums/file-purpose.enum";
import { FileAudienceType } from "@/domain/file-management/enums/file-audience-type.enum";
import { validateFileUpload } from "@/core/utils/security.utils";
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
  // Audience context for organized file storage
  purpose?: FilePurpose;
  audienceType?: FileAudienceType;
  audienceId?: string;
}

export interface UploadFileUseCaseResult {
  file: File;
  uploadUrl: string;
}

export type UploadFileUseCaseResponse = Either<Error, UploadFileUseCaseResult>;

@Injectable()
export class UploadFileUseCase {
  private readonly logger = new Logger(UploadFileUseCase.name);

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
    purpose = FilePurpose.GENERAL,
    audienceType,
    audienceId,
  }: UploadFileUseCaseRequest): Promise<UploadFileUseCaseResponse> {
    // Validate file upload parameters (MIME type, size, extension)
    const validation = validateFileUpload(filename, mimeType, size);
    if (!validation.isValid) {
      this.logger.warn(
        `File upload validation failed: ${validation.error} - filename: ${filename}, mimeType: ${mimeType}, size: ${size}`,
      );
      return left(new BadRequestException(validation.error));
    }

    const fileId = new UniqueEntityID().toString();

    // Build storage key with purpose and audience context
    // Format: files/{campusId}/{purpose}/{audienceType}/{audienceId?}/{fileId}-{filename}
    const key = this.buildStorageKey({
      campusId,
      purpose,
      audienceType,
      audienceId,
      fileId,
      filename,
    });

    // Determine default storage provider from environment
    const defaultStorageProvider = process.env.CLOUDFLARE_R2_BUCKET
      ? "R2"
      : "LOCAL";

    // Determine classId and gradeLevelId based on audienceType
    let classId: string | null = null;
    let gradeLevelId: string | null = null;

    if (audienceType === FileAudienceType.CLASS && audienceId) {
      classId = audienceId;
    } else if (audienceType === FileAudienceType.GRADE && audienceId) {
      gradeLevelId = audienceId;
    }

    const file = File.create(
      {
        key,
        filename,
        mimeType,
        size: BigInt(size),
        uploadedBy,
        campusId,
        bucket: bucket ?? process.env.CLOUDFLARE_R2_BUCKET ?? null,
        storageProvider: storageProvider ?? defaultStorageProvider,
        purpose,
        audienceType: audienceType ?? null,
        audienceId: audienceId ?? null,
        classId,
        gradeLevelId,
      },
      fileId,
    );

    let uploadUrl: string;
    try {
      uploadUrl = await this.storageService.getUploadSignedUrl(key, mimeType);
    } catch (error) {
      console.error("Storage service error:", error);
      return left(
        new Error(
          `Failed to get upload signed URL: ${error instanceof Error ? error.message : "Unknown error"}`,
        ),
      );
    }

    const createdFile = await this.fileRepository.create(file);

    return right({
      file: createdFile,
      uploadUrl,
    });
  }

  /**
   * Build a hierarchical storage key for organized file storage
   * Format: files/{campusId}/{purpose}/{audienceType}/{audienceId?}/{fileId}-{filename}
   */
  private buildStorageKey(params: {
    campusId: string;
    purpose: FilePurpose;
    audienceType?: FileAudienceType;
    audienceId?: string;
    fileId: string;
    filename: string;
  }): string {
    const { campusId, purpose, audienceType, audienceId, fileId, filename } =
      params;

    const parts = ["files", campusId, purpose.toLowerCase()];

    if (audienceType) {
      parts.push(audienceType.toLowerCase());

      if (audienceId && audienceType !== FileAudienceType.ALL) {
        parts.push(audienceId);
      }
    }

    parts.push(`${fileId}-${filename}`);

    return parts.join("/");
  }
}
