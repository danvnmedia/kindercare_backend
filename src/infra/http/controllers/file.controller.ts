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
    private completeUploadUseCase: CompleteUploadUseCase,
  ) {}

  @Post("initiate-upload")
  @RequireCampusAccess({ checkUserAccess: false })
  @ApiHeader({ name: CAMPUS_ID_HEADER, required: true })
  @ApiOperation({
    summary: "Initiate a file upload",
    description:
      "Initiates a file upload and returns a presigned URL. Files are organized by campus, purpose, and audience scope.",
  })
  @StandardResponse({
    type: InitiateUploadResponse,
  })
  async initiateUpload(
    @Body()
    {
      filename,
      mimeType,
      size,
      campusId,
      storageProvider,
      purpose,
      audienceType,
      audienceId,
    }: InitiateUploadRequest,
    @CurrentUser() user: User,
    @CampusContext() contextCampusId: string,
  ): Promise<InitiateUploadResponse> {
    // Use campusId from context (validated by guard) if not explicitly provided in body
    const effectiveCampusId = campusId || contextCampusId;

    const result = await this.uploadFile.execute({
      filename,
      mimeType,
      size,
      uploadedBy: user.id.toString(),
      campusId: effectiveCampusId,
      storageProvider,
      purpose,
      audienceType,
      audienceId,
    });

    if (result.isLeft()) {
      throw result.value;
    }

    return {
      fileId: result.value.file.id.toString(),
      key: result.value.file.key,
      uploadUrl: result.value.uploadUrl,
    };
  }

  @Post(":id/complete")
  @RequireCampusAccess({ checkUserAccess: false })
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
  @RequireCampusAccess({ checkUserAccess: false })
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
  @RequireCampusAccess({ checkUserAccess: false })
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
