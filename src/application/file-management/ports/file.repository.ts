import { File } from "../../../domain/file-management/entities/file.entity";

export abstract class FileRepository {
  abstract create(file: File): Promise<File>;
  abstract update(file: File): Promise<File>;
  abstract findById(id: string): Promise<File | null>;
  abstract findByIds(ids: string[]): Promise<File[]>;
  abstract delete(id: string): Promise<void>;
}
