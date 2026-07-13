import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { UniqueEntityID } from "@/core/entities/unique-entity-id";
import { Either, left, right } from "@/core/types/either";
import { File } from "@/domain/file-management/entities/file.entity";
import { FilePurpose } from "@/domain/file-management/enums/file-purpose.enum";
import { FileAudienceType } from "@/domain/file-management/enums/file-audience-type.enum";
import {
  sanitizeUploadFilename,
  validateFileUpload,
} from "@/core/utils/security.utils";
import { ClassRepository } from "@/application/class-management/ports/class.repository";

import { FileRepository } from "../ports/file.repository";
import { StorageService } from "../ports/storage.service";

export interface UploadFileUseCaseRequest {
  filename: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  campusId: string;
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
    @Inject("FILE_REPOSITORY")
    private fileRepository: FileRepository,
    private storageService: StorageService,
    @Inject("CLASS_REPOSITORY")
    private classRepository: ClassRepository,
  ) {}

  async execute({
    filename,
    mimeType,
    size,
    uploadedBy,
    campusId,
    purpose = FilePurpose.GENERAL,
    audienceType,
    audienceId,
  }: UploadFileUseCaseRequest): Promise<UploadFileUseCaseResponse> {
    if (!campusId) {
      return left(new BadRequestException("campusId is required."));
    }

    // Validate file upload parameters (MIME type, size, extension)
    const validation = validateFileUpload(filename, mimeType, size);
    if (!validation.isValid) {
      this.logger.warn(
        `File upload validation failed: ${validation.error} - filename: ${filename}, mimeType: ${mimeType}, size: ${size}`,
      );
      return left(new BadRequestException(validation.error));
    }

    const audienceValidation = await this.validateAudienceContext({
      campusId,
      purpose,
      audienceType,
      audienceId,
    });
    if (audienceValidation) {
      return left(audienceValidation);
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

    const isR2Configured = Boolean(
      process.env.CLOUDFLARE_ACCOUNT_ID &&
        process.env.CLOUDFLARE_R2_ACCESS_KEY &&
        process.env.CLOUDFLARE_R2_SECRET_KEY &&
        process.env.CLOUDFLARE_R2_BUCKET,
    );
    const defaultStorageProvider = isR2Configured ? "R2" : "LOCAL";

    const classId =
      audienceType === FileAudienceType.CLASS && audienceId ? audienceId : null;
    const gradeLevelId: string | null = null;

    const file = File.create(
      {
        key,
        filename,
        mimeType,
        size: BigInt(size),
        uploadedBy,
        campusId,
        bucket: isR2Configured ? process.env.CLOUDFLARE_R2_BUCKET! : null,
        storageProvider: defaultStorageProvider,
        purpose,
        audienceType: audienceType ?? null,
        audienceId: audienceId ?? null,
        classId,
        gradeLevelId,
      },
      fileId,
    );

    const createdFile = await this.fileRepository.create(file);

    let uploadUrl: string;
    try {
      uploadUrl = await this.storageService.getUploadSignedUrl(key, mimeType);
    } catch (error) {
      this.logger.error("Failed to get upload signed URL", error);
      createdFile.markAsError();
      await this.fileRepository.update(createdFile);
      return left(
        new Error(
          `Failed to get upload signed URL: ${error instanceof Error ? error.message : "Unknown error"}`,
        ),
      );
    }

    return right({
      file: createdFile,
      uploadUrl,
    });
  }

  /**
   * Build a hierarchical storage key for organized file storage
   * Format: files/{campusId}/{derivedPath}/{fileId}-{filename}
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

    const parts = [
      "files",
      campusId,
      ...this.resolveDefaultPathParts(purpose, audienceType, audienceId),
    ];

    parts.push(`${fileId}-${sanitizeUploadFilename(filename)}`);

    return parts.join("/");
  }

  private async validateAudienceContext(params: {
    campusId: string;
    purpose: FilePurpose;
    audienceType?: FileAudienceType;
    audienceId?: string;
  }): Promise<Error | null> {
    const { campusId, purpose, audienceType, audienceId } = params;

    void purpose;

    if (audienceType === FileAudienceType.CLASS && !audienceId) {
      return new BadRequestException(
        "audienceId is required for class scoped uploads.",
      );
    }

    if (!audienceType || audienceType === FileAudienceType.ALL) {
      return null;
    }

    if (audienceType === FileAudienceType.CLASS) {
      const classEntity = await this.classRepository.findById(audienceId!);
      if (!classEntity || classEntity.campusId !== campusId) {
        return new NotFoundException("Class audience not found in campus.");
      }
      return null;
    }

    return new BadRequestException(
      "Unsupported file audience type. Use ALL/campus or CLASS scope.",
    );
  }

  private resolveDefaultPathParts(
    purpose: FilePurpose,
    audienceType?: FileAudienceType,
    audienceId?: string,
  ): string[] {
    if (purpose === FilePurpose.POST_ATTACHMENT) return ["attachment"];
    if (purpose === FilePurpose.PROFILE_PHOTO) return ["profile"];
    if (purpose === FilePurpose.ATTENDANCE_IMAGE) return ["attendance"];

    if (audienceType === FileAudienceType.CLASS && audienceId) {
      return ["class", audienceId];
    }
    if (audienceType === FileAudienceType.ALL) return ["all"];

    return [purpose.toLowerCase()];
  }
}
