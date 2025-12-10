import { UniqueEntityID } from '@/core/entities/unique-entity-id';
import { Either, left, right } from '@/core/types/either';
import { File } from '@/domain/file-management/entities/file.entity';
import { FileStatus } from '@/domain/file-management/enums/file-status.enum';
import { FileRepository } from '../ports/file.repository';

export interface CompleteUploadUseCaseRequest {
  fileId: UniqueEntityID;
}

export type CompleteUploadUseCaseResponse = Either<Error, File>;

export class CompleteUploadUseCase {
  constructor(private fileRepository: FileRepository) {}

  async execute({
    fileId,
  }: CompleteUploadUseCaseRequest): Promise<CompleteUploadUseCaseResponse> {
    const file = await this.fileRepository.findById(fileId.toString());

    if (!file) {
      return left(new Error('File not found.'));
    }

    // Optionally, add logic to verify file existence in storage
    // if a separate verification mechanism is available for the storage service.

    const updatedFile = await this.fileRepository.updateStatus(
      file.id.toString(),
      FileStatus.ACTIVE,
    );

    return right(updatedFile);
  }
}
