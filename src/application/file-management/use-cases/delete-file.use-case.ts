import { UniqueEntityID } from "@/core/entities/unique-entity-id";
import { Either, left, right } from "@/core/types/either";
import { FileRepository } from "../ports/file.repository";
import { StorageService } from "../ports/storage.service";

export interface DeleteFileUseCaseRequest {
  fileId: UniqueEntityID;
  campusId: string;
}

export type DeleteFileUseCaseResponse = Either<Error, void>;

export class DeleteFileUseCase {
  constructor(
    private fileRepository: FileRepository,
    private storageService: StorageService,
  ) {}

  async execute({
    fileId,
    campusId,
  }: DeleteFileUseCaseRequest): Promise<DeleteFileUseCaseResponse> {
    // Find file with campus verification to ensure user can only delete files in their campus
    const file = await this.fileRepository.findByIdAndCampus(
      fileId.toString(),
      campusId,
    );

    if (!file) {
      return left(new Error("File not found."));
    }

    try {
      await this.storageService.delete(file.key);
    } catch (error) {
      return left(new Error("File deletion failed from storage."));
    }

    file.markAsDeleted();
    await this.fileRepository.update(file);

    return right(undefined);
  }
}
