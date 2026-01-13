import { Injectable } from "@nestjs/common";
import { UniqueEntityID } from "@/core/entities/unique-entity-id";
import { Either, left, right } from "@/core/types/either";
import { File } from "@/domain/file-management/entities/file.entity";
import { FileRepository } from "../ports/file.repository";
import { StorageService } from "../ports/storage.service";

export interface GetFileUseCaseRequest {
  fileId: UniqueEntityID;
  campusId: string;
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
  }: GetFileUseCaseRequest): Promise<GetFileUseCaseResponse> {
    // Find file with campus verification to ensure user can only access files in their campus
    // Repository already excludes soft-deleted files by default
    const file = await this.fileRepository.findByIdAndCampus(
      fileId.toString(),
      campusId,
    );

    if (!file) {
      return left(new Error("File not found."));
    }

    const url = await this.storageService.getSignedUrl(file.key);

    return right({ file, url });
  }
}
