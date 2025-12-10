import { Module } from '@nestjs/common';
import { FileController } from '@/infra/http/controllers/file.controller';
import { UploadFileUseCase } from '../../../../application/file-management/use-cases/upload-file.use-case';
import { DeleteFileUseCase } from '../../../../application/file-management/use-cases/delete-file.use-case';
import { GetFileUseCase } from '../../../../application/file-management/use-cases/get-file.use-case';
import { CompleteUploadUseCase } from '../../../../application/file-management/use-cases/complete-upload.use-case';
import { FileRepository } from '../../../../application/file-management/ports/file.repository';
import { StorageService } from '../../../../application/file-management/ports/storage.service';
import { PrismaFileRepository } from '../../../persistence/prisma/repositories/prisma-file.repository';
import { StorageModule } from '../../../storage/storage.module';
import { PrismaService } from '../../../persistence/prisma/prisma.service';

@Module({
  imports: [StorageModule],
  controllers: [FileController],
  providers: [
    PrismaService,
    {
      provide: FileRepository,
      useClass: PrismaFileRepository,
    },
    UploadFileUseCase,
    DeleteFileUseCase,
    GetFileUseCase,
    CompleteUploadUseCase,
  ],
})
export class FileManagementModule {}
