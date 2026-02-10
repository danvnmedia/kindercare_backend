import { Module } from "@nestjs/common";
import { FileController } from "@/infra/http/controllers/file.controller";
import { UploadFileUseCase } from "../../../../application/file-management/use-cases/upload-file.use-case";
import { DeleteFileUseCase } from "../../../../application/file-management/use-cases/delete-file.use-case";
import { GetFileUseCase } from "../../../../application/file-management/use-cases/get-file.use-case";
import { CompleteUploadUseCase } from "../../../../application/file-management/use-cases/complete-upload.use-case";
import { FileRepository } from "../../../../application/file-management/ports/file.repository";
import { StorageModule } from "../../../storage/storage.module";
import { PrismaFileRepository } from "../../../persistence/prisma/repositories/prisma-file.repository";
import { PrismaService } from "../../../persistence/prisma/prisma.service";
import { ClerkModule } from "../../../external-services/clerk/clerk.module";
import { UserManagementModule } from "../user-management.module";
import { StandardResponseModule } from "@/core/modules/standard-response/standard-response.module";
import { CampusModule } from "../campus.module";
import { RequestContextModule } from "../../context/request-context.module";

@Module({
  imports: [
    StorageModule,
    ClerkModule,
    UserManagementModule,
    StandardResponseModule,
    CampusModule,
    RequestContextModule,
  ],
  controllers: [FileController],
  providers: [
    CampusGuard,
    PrismaService,
    {
      provide: FileRepository,
      useClass: PrismaFileRepository,
    },
    {
      provide: "FILE_REPOSITORY",
      useClass: PrismaFileRepository,
    },
    UploadFileUseCase,
    DeleteFileUseCase,
    GetFileUseCase,
    CompleteUploadUseCase,
  ],
  exports: ["FILE_REPOSITORY"],
})
export class FileManagementModule {}
