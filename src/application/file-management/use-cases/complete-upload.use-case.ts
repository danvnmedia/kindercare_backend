import { UniqueEntityID } from "@/core/entities/unique-entity-id";
import { Either, left, right } from "@/core/types/either";
import { File } from "@/domain/file-management/entities/file.entity";
import { FileRepository } from "../ports/file.repository";

export interface CompleteUploadUseCaseRequest {
  fileId: UniqueEntityID;
  campusId: string;
}

export type CompleteUploadUseCaseResponse = Either<Error, File>;

export class CompleteUploadUseCase {
  constructor(private fileRepository: FileRepository) {}

  async execute({
    fileId,
    campusId,
  }: CompleteUploadUseCaseRequest): Promise<CompleteUploadUseCaseResponse> {
    // Find file with campus verification to ensure user can only complete uploads in their campus
    const file = await this.fileRepository.findByIdAndCampus(
      fileId.toString(),
      campusId,
    );

    if (!file) {
      return left(new Error("File not found."));
    }

    // Optionally, add logic to verify file existence in storage
    // if a separate verification mechanism is available for the storage service.

    file.markAsUploaded();
    const updatedFile = await this.fileRepository.update(file);

    return right(updatedFile);
  }
}
