import { FileStatus } from "@/domain/file-management/enums/file-status.enum";
import {
  Controller,
  Post,
  Get,
  Param,
  UseInterceptors,
  ParseUUIDPipe,
  Body,
  ClassSerializerInterceptor,
  UseGuards,
  Delete,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { StandardResponse } from "@/core/modules/standard-response/decorators";
import { UploadFileUseCase } from "../../../application/file-management/use-cases/upload-file.use-case";
import { DeleteFileUseCase } from "../../../application/file-management/use-cases/delete-file.use-case";
import { GetFileUseCase } from "../../../application/file-management/use-cases/get-file.use-case";
import { CompleteUploadUseCase } from "../../../application/file-management/use-cases/complete-upload.use-case";
import { CurrentUser } from "../decorators/current-user.decorator";
import { UniqueEntityID } from "../../../core/entities/unique-entity-id";
import { InitiateUploadRequest } from "../dtos/file/initiate-upload.request";
import { FileResponse } from "../dtos/file/file.response";
import { InitiateUploadResponse } from "../dtos/file/initiate-upload.response";
import { UserPayload } from "@/types/globals";
import { ClerkAuthGuard } from "../guards/clerk-auth.guard";
import { UserInterceptor } from "../interceptors/user.interceptor";

@ApiTags("File Management")
@ApiBearerAuth("JWT")
@Controller("files")
@UseGuards(ClerkAuthGuard)
@UseInterceptors(UserInterceptor, ClassSerializerInterceptor)
export class FileController {
  constructor(
    private uploadFile: UploadFileUseCase,
    private deleteFile: DeleteFileUseCase,
    private getFile: GetFileUseCase,
    private completeUploadUseCase: CompleteUploadUseCase, // Renamed to avoid conflict
  ) {}

  @Post("initiate-upload")
  @ApiOperation({ summary: "Initiate a file upload" })
  @StandardResponse({
    type: InitiateUploadResponse,
  })
  async initiateUpload(
    @Body() { filename, mimeType, size }: InitiateUploadRequest,
    @CurrentUser() user: UserPayload,
  ): Promise<InitiateUploadResponse> {
    const result = await this.uploadFile.execute({
      filename,
      mimeType,
      size,
      uploadedBy: new UniqueEntityID(user.sub),
    });

    if (result.isLeft()) {
      throw result.value; // TODO: Map to appropriate HTTP exception
    }

    return {
      key: result.value.file.key,
      uploadUrl: result.value.uploadUrl,
    };
  }

  @Post(":id/complete")
  @ApiOperation({ summary: "Complete a file upload" })
  @StandardResponse({
    type: FileResponse,
  })
  async completeUpload(
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<FileResponse> {
    const result = await this.completeUploadUseCase.execute({
      fileId: new UniqueEntityID(id),
    });

    if (result.isLeft()) {
      throw result.value; // TODO: Map to appropriate HTTP exception
    }

    const file = result.value;
    const response = new FileResponse();
    response.id = file.id.toString();
    response.key = file.key;
    response.filename = file.filename;
    response.mimeType = file.mimeType;
    response.size = file.size;
    response.status = file.status as FileStatus;
    response.uploadedBy = file.uploadedBy.toString();
    response.createdAt = file.createdAt;
    response.updatedAt = file.updatedAt;

    return response;
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a file by ID" })
  @StandardResponse({
    type: FileResponse,
  })
  async get(@Param("id", ParseUUIDPipe) id: string): Promise<FileResponse> {
    const result = await this.getFile.execute({
      fileId: new UniqueEntityID(id),
    });

    if (result.isLeft()) {
      throw result.value; // TODO: Map to appropriate HTTP exception
    }

    const { file } = result.value;
    const response = new FileResponse();
    response.id = file.id.toString();
    response.key = file.key;
    response.filename = file.filename;
    response.mimeType = file.mimeType;
    response.size = file.size;
    response.status = file.status as FileStatus;
    response.uploadedBy = file.uploadedBy.toString();
    response.createdAt = file.createdAt;
    response.updatedAt = file.updatedAt;

    return response;
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete a file" })
  async delete(@Param("id", ParseUUIDPipe) id: string): Promise<void> {
    const result = await this.deleteFile.execute({
      fileId: new UniqueEntityID(id),
      // TODO: Add logic to check if user is owner or admin
    });

    if (result.isLeft()) {
      throw result.value; // TODO: Map to appropriate HTTP exception
    }
  }
}
