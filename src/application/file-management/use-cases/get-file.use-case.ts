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
import { FilePurpose } from "@/domain/file-management/enums/file-purpose.enum";
import { StorageService } from "../ports/storage.service";

export interface GetFileUseCaseRequest {
  fileId: UniqueEntityID;
  campusId: string;
  requestedBy: string;
  canReadAny: boolean;
}

export type GetFileUseCaseResponse = Either<Error, { file: File; url: string }>;

@Injectable()
export class GetFileUseCase {
  constructor(
    private fileRepository: FileRepository,
    private storageService: StorageService,
  ) {}

  async execute({
    fileId,
    campusId,
    requestedBy,
    canReadAny,
  }: GetFileUseCaseRequest): Promise<GetFileUseCaseResponse> {
    // Find file with campus verification to ensure user can only access files in their campus
    // Repository already excludes soft-deleted files by default
    const file = await this.fileRepository.findByIdAndCampus(
      fileId.toString(),
      campusId,
    );

    if (!file) {
      return left(new NotFoundException("File not found."));
    }

    if (
      file.purpose === FilePurpose.POST_ATTACHMENT &&
      file.uploadedBy !== requestedBy &&
      !canReadAny
    ) {
      return left(
        new ForbiddenException(
          "Post attachments must be accessed through an authorized post.",
        ),
      );
    }

    if (!file.isAvailable()) {
      return left(new BadRequestException("File is not available."));
    }

    const url = await this.storageService.getSignedUrl(file.key);

    return right({ file, url });
  }
}
