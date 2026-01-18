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
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiHeader,
} from "@nestjs/swagger";
import { StandardResponse } from "@/core/modules/standard-response/decorators";
import { UploadFileUseCase } from "../../../application/file-management/use-cases/upload-file.use-case";
import { DeleteFileUseCase } from "../../../application/file-management/use-cases/delete-file.use-case";
import { GetFileUseCase } from "../../../application/file-management/use-cases/get-file.use-case";
import { CompleteUploadUseCase } from "../../../application/file-management/use-cases/complete-upload.use-case";
import { CurrentUser } from "../decorators/current-user.decorator";
import {
  RequireCampusAccess,
  CampusContext,
  CAMPUS_ID_HEADER,
} from "../decorators";
import { UniqueEntityID } from "../../../core/entities/unique-entity-id";
import { InitiateUploadRequest } from "../dtos/file/initiate-upload.request";
import { FileResponse } from "../dtos/file/file.response";
import { InitiateUploadResponse } from "../dtos/file/initiate-upload.response";
import { User } from "@/domain/user-management/user.entity";
import { ClerkAuthGuard } from "../guards/clerk-auth.guard";

/**
 * File Management Controller
 *
 * Handles file upload, retrieval, and deletion endpoints.
 * Uses hybrid auth pattern: AuthMiddleware + ClerkAuthGuard + RequestContext.
 *
 * Request Flow:
 * 1. AuthMiddleware verifies Clerk token
 * 2. ClerkAuthGuard checks authentication
 * 3. CampusGuard validates campus access (via @RequireCampusAccess)
 * 4. @CurrentUser decorator retrieves user from RequestContext (cached)
 */
@ApiTags("File Management")
@ApiBearerAuth("JWT")
@Controller("files")
@UseGuards(ClerkAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class FileController {
  constructor(
    private uploadFile: UploadFileUseCase,
    private deleteFile: DeleteFileUseCase,
    private getFile: GetFileUseCase,
    private completeUploadUseCase: CompleteUploadUseCase,
  ) {}

  @Post("initiate-upload")
  @RequireCampusAccess()
  @ApiHeader({ name: CAMPUS_ID_HEADER, required: true })
  @ApiOperation({ summary: "Initiate a file upload" })
  @StandardResponse({
    type: InitiateUploadResponse,
  })
  async initiateUpload(
    @Body()
    { filename, mimeType, size, storageProvider }: InitiateUploadRequest,
    @CurrentUser() user: User,
    @CampusContext() campusId: string,
  ): Promise<InitiateUploadResponse> {
    const result = await this.uploadFile.execute({
      filename,
      mimeType,
      size,
      uploadedBy: user.id, // Use User entity's ID (UUID)
      campusId,
      storageProvider,
    });

    if (result.isLeft()) {
      throw result.value;
    }

    return {
      key: result.value.file.key,
      uploadUrl: result.value.uploadUrl,
    };
  }

  @Post(":id/complete")
  @RequireCampusAccess()
  @ApiHeader({ name: CAMPUS_ID_HEADER, required: true })
  @ApiOperation({ summary: "Complete a file upload" })
  @StandardResponse({
    type: FileResponse,
  })
  async completeUpload(
    @Param("id", ParseUUIDPipe) id: string,
    @CampusContext() campusId: string,
  ) {
    const result = await this.completeUploadUseCase.execute({
      fileId: new UniqueEntityID(id),
      campusId,
    });

    if (result.isLeft()) {
      throw result.value;
    }

    return result.value;
  }

  @Get(":id")
  @RequireCampusAccess()
  @ApiHeader({ name: CAMPUS_ID_HEADER, required: true })
  @ApiOperation({ summary: "Get a file by ID" })
  @StandardResponse({
    type: FileResponse,
  })
  async get(
    @Param("id", ParseUUIDPipe) id: string,
    @CampusContext() campusId: string,
  ) {
    const result = await this.getFile.execute({
      fileId: new UniqueEntityID(id),
      campusId,
    });

    if (result.isLeft()) {
      throw result.value;
    }

    const { file } = result.value;
    return file;
  }

  @Delete(":id")
  @RequireCampusAccess()
  @ApiHeader({ name: CAMPUS_ID_HEADER, required: true })
  @ApiOperation({ summary: "Soft delete a file" })
  async delete(
    @Param("id", ParseUUIDPipe) id: string,
    @CampusContext() campusId: string,
  ): Promise<void> {
    const result = await this.deleteFile.execute({
      fileId: new UniqueEntityID(id),
      campusId,
    });

    if (result.isLeft()) {
      throw result.value;
    }
  }
}
