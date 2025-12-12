import { UniqueEntityID } from "@/core/entities/unique-entity-id";
import { Either, left, right } from "@/core/types/either";
import { File } from "@/domain/file-management/entities/file.entity";
import { FileRepository } from "../ports/file.repository";
import { StorageService } from "../ports/storage.service";

export interface GetFileUseCaseRequest {
  fileId: UniqueEntityID;
}

export type GetFileUseCaseResponse = Either<Error, { file: File; url: string }>;

export class GetFileUseCase {
  constructor(
    private fileRepository: FileRepository,
    private storageService: StorageService,
  ) {}

  async execute({
    fileId,
  }: GetFileUseCaseRequest): Promise<GetFileUseCaseResponse> {
    const file = await this.fileRepository.findById(fileId.toString());

    if (!file) {
      return left(new Error("File not found."));
    }

    const url = await this.storageService.getSignedUrl(file.key);

    return right({ file, url });
  }
}
