import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { UniqueEntityID } from "@/core/entities/unique-entity-id";
import { Either, left, right } from "@/core/types/either";
import { File } from "@/domain/file-management/entities/file.entity";
import { FileRepository } from "../ports/file.repository";
import { StorageService } from "../ports/storage.service";

export interface CompleteUploadUseCaseRequest {
  fileId: UniqueEntityID;
  campusId: string;
  uploadedBy: string;
}

export type CompleteUploadUseCaseResponse = Either<
  Error,
  { file: File; url: string }
>;

@Injectable()
export class CompleteUploadUseCase {
  constructor(
    private fileRepository: FileRepository,
    private storageService: StorageService,
  ) {}

  async execute({
    fileId,
    campusId,
    uploadedBy,
  }: CompleteUploadUseCaseRequest): Promise<CompleteUploadUseCaseResponse> {
    // Find file with campus verification to ensure user can only complete uploads in their campus
    const file = await this.fileRepository.findByIdAndCampus(
      fileId.toString(),
      campusId,
    );

    if (!file) {
      return left(new NotFoundException("File not found."));
    }

    if (file.uploadedBy !== uploadedBy) {
      return left(
        new ForbiddenException("Only the uploader can complete this file."),
      );
    }

    if (!file.isPending()) {
      return left(
        new BadRequestException("Only pending files can be completed."),
      );
    }

    const metadata = await this.storageService.getObjectMetadata(file.key);
    if (!metadata.exists) {
      return left(
        new BadRequestException("Uploaded object was not found in storage."),
      );
    }

    if (
      typeof metadata.contentLength === "number" &&
      metadata.contentLength !== Number(file.size)
    ) {
      return left(
        new BadRequestException(
          "Uploaded object size does not match initiated file size.",
        ),
      );
    }

    if (metadata.contentType && metadata.contentType !== file.mimeType) {
      return left(
        new BadRequestException(
          "Uploaded object content type does not match initiated file type.",
        ),
      );
    }

    file.markAsUploaded();
    const updatedFile = await this.fileRepository.update(file);
    const url = await this.storageService.getSignedUrl(updatedFile.key);

    return right({ file: updatedFile, url });
  }
}
