import { UniqueEntityID } from "@/core/entities/unique-entity-id";
import { Either, left, right } from "@/core/types/either";
import { FileRepository } from "../ports/file.repository";

export interface DeleteFileUseCaseRequest {
  fileId: UniqueEntityID;
  campusId: string;
}

export type DeleteFileUseCaseResponse = Either<Error, void>;

export class DeleteFileUseCase {
  constructor(private fileRepository: FileRepository) {}

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

    // Soft delete - mark as deleted but keep the file in storage for potential recovery
    file.markAsDeleted();
    await this.fileRepository.update(file);

    return right(undefined);
  }
}
