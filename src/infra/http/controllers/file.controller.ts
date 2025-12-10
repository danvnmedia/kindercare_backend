import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UseInterceptors,
  ParseUUIDPipe,
  Body,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import { UploadFileUseCase } from '../../../application/file-management/use-cases/upload-file.use-case';
import { DeleteFileUseCase } from '../../../application/file-management/use-cases/delete-file.use-case';
import { GetFileUseCase } from '../../../application/file-management/use-cases/get-file.use-case';
import { CompleteUploadUseCase } from '../../../application/file-management/use-cases/complete-upload.use-case';
import { CurrentUser } from '../decorators/current-user.decorator';
import { UniqueEntityID } from '../../../core/entities/unique-entity-id';
import { InitiateUploadRequest } from '../dtos/file/initiate-upload.request';
import { FileResponse } from '../dtos/file';
import { UserPayload } from '@/types/globals';

@Controller('files')
@UseInterceptors(ClassSerializerInterceptor)
export class FileController {
  constructor(
    private uploadFile: UploadFileUseCase,
    private deleteFile: DeleteFileUseCase,
    private getFile: GetFileUseCase,
    private completeUploadUseCase: CompleteUploadUseCase, // Renamed to avoid conflict
  ) {}

  @Post('initiate-upload')
  async initiateUpload(
    @Body() { filename, mimeType, size }: InitiateUploadRequest,
    @CurrentUser() user: UserPayload,
  ) {
    const result = await this.uploadFile.execute({
      filename,
      mimeType,
      size,
      uploadedBy: new UniqueEntityID(user.sub),
    });

    if (result.isLeft()) {
      throw result.value; // TODO: Map to appropriate HTTP exception
    }

    return { fileId: result.value.file.id.toString(), uploadUrl: result.value.uploadUrl };
  }

  @Post(':id/complete')
  async completeUpload(@Param('id', ParseUUIDPipe) id: string) {
    const result = await this.completeUploadUseCase.execute({
      fileId: new UniqueEntityID(id),
    });

    if (result.isLeft()) {
      throw result.value; // TODO: Map to appropriate HTTP exception
    }

    return { message: 'File upload completed successfully', fileId: result.value.id.toString() };
  }

  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string) {
    const result = await this.getFile.execute({ fileId: new UniqueEntityID(id) });

    if (result.isLeft()) {
      throw result.value; // TODO: Map to appropriate HTTP exception
    }

    const { file, url } = result.value;
    const response = new FileResponse();
    response.id = file.id.toString();
    response.key = file.key;
    response.filename = file.filename;
    response.mimeType = file.mimeType;
    response.size = file.size;
    response.status = file.status;
    response.uploadedBy = file.uploadedBy.toString();
    response.createdAt = file.createdAt;
    response.updatedAt = file.updatedAt;

    return { file: response, url };
  }

  @Delete(':id')
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: UserPayload,
  ) {
    const result = await this.deleteFile.execute({
      fileId: new UniqueEntityID(id),
      // TODO: Add logic to check if user is owner or admin
    });

    if (result.isLeft()) {
      throw result.value; // TODO: Map to appropriate HTTP exception
    }

    return { message: 'File deleted successfully' };
  }
}
