import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { UniqueEntityID } from "@/core/entities/unique-entity-id";
import { Either, left, right } from "@/core/types/either";
import { FileRepository } from "../ports/file.repository";

export interface DeleteFileUseCaseRequest {
  fileId: UniqueEntityID;
  campusId: string;
  deletedBy: string;
  isAdmin: boolean;
}

export type DeleteFileUseCaseResponse = Either<Error, void>;

@Injectable()
export class DeleteFileUseCase {
  constructor(private fileRepository: FileRepository) {}

  async execute({
    fileId,
    campusId,
    deletedBy,
    isAdmin,
  }: DeleteFileUseCaseRequest): Promise<DeleteFileUseCaseResponse> {
    // Find file with campus verification to ensure user can only delete files in their campus
    const file = await this.fileRepository.findByIdAndCampus(
      fileId.toString(),
      campusId,
    );

    if (!file) {
      return left(new NotFoundException("File not found."));
    }

    if (file.uploadedBy !== deletedBy && !isAdmin) {
      return left(
        new ForbiddenException(
          "Only the uploader or an admin can delete this file.",
        ),
      );
    }

    // Soft delete - mark as deleted but keep the file in storage for potential recovery
    file.markAsDeleted();
    await this.fileRepository.update(file);

    return right(undefined);
  }
}
