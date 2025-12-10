import { File } from '../../../domain/file-management/entities/file.entity';
import { FileStatus } from '../../../domain/file-management/enums/file-status.enum';

export abstract class FileRepository {
  abstract create(file: File): Promise<File>;
  abstract findById(id: string): Promise<File | null>;
  abstract findByIds(ids: string[]): Promise<File[]>;
  abstract updateStatus(id: string, status: FileStatus): Promise<File>;
  abstract delete(id: string): Promise<void>;
}
