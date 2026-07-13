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
  HttpCode,
  HttpStatus,
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
import { File } from "@/domain/file-management/entities/file.entity";
import { RoleEntity } from "@/domain/user-management/role.entity";
import { isGlobalAdmin } from "../context/campus-context";
import { ClerkAuthGuard } from "../guards/clerk-auth.guard";
import { PermissionsGuard } from "../guards/permissions.guard";
import { Permissions } from "../decorators/permissions.decorator";

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

  private toFileResponse(file: File, url: string): FileResponse {
    return {
      id: file.id.toString(),
      campusId: file.campusId,
      key: file.key,
      url,
      bucket: file.bucket,
      storageProvider: file.storageProvider,
      filename: file.filename,
      mimeType: file.mimeType,
      size: Number(file.size),
      extension: file.extension,
      purpose: file.purpose,
      audienceType: file.audienceType,
      audienceId: file.audienceId,
      classId: file.classId,
      gradeLevelId: file.gradeLevelId,
      status: file.status,
      isDeleted: file.isDeleted,
      uploadedBy: file.uploadedBy,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
    };
  }

  @Post("initiate-upload")
  @HttpCode(HttpStatus.CREATED)
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("file.create")
  @ApiHeader({ name: CAMPUS_ID_HEADER, required: true })
  @ApiOperation({
    summary: "Initiate a file upload",
    description:
      "Initiates a file upload and returns a presigned URL. Files are organized by campus, purpose, and audience scope.",
  })
  @StandardResponse({
    type: InitiateUploadResponse,
    status: HttpStatus.CREATED,
  })
  async initiateUpload(
    @Body()
    {
      filename,
      mimeType,
      size,
      purpose,
      audienceType,
      audienceId,
    }: InitiateUploadRequest,
    @CurrentUser() user: User,
    @CampusContext() campusId: string,
  ): Promise<InitiateUploadResponse> {
    const result = await this.uploadFile.execute({
      filename,
      mimeType,
      size,
      uploadedBy: user.id.toString(),
      campusId,
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
  @HttpCode(HttpStatus.CREATED)
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("file.create")
  @ApiHeader({ name: CAMPUS_ID_HEADER, required: true })
  @ApiOperation({ summary: "Complete a file upload" })
  @StandardResponse({
    type: FileResponse,
    status: HttpStatus.CREATED,
  })
  async completeUpload(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @CampusContext() campusId: string,
  ) {
    const result = await this.completeUploadUseCase.execute({
      fileId: new UniqueEntityID(id),
      campusId,
      uploadedBy: user.id.toString(),
    });

    if (result.isLeft()) {
      throw result.value;
    }

    return this.toFileResponse(result.value.file, result.value.url);
  }

  @Get(":id")
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("file.read")
  @ApiHeader({ name: CAMPUS_ID_HEADER, required: true })
  @ApiOperation({ summary: "Get a file by ID" })
  @StandardResponse({
    type: FileResponse,
  })
  async get(
    @CampusContext() campusId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentUser() user: User,
  ) {
    const result = await this.getFile.execute({
      fileId: new UniqueEntityID(id),
      campusId,
      requestedBy: user.id.toString(),
      canReadAny:
        isGlobalAdmin(user) ||
        user
          .getRolesForCampus(campusId)
          .some((role) => RoleEntity.hasPermissionById(role, "file.manage")),
    });

    if (result.isLeft()) {
      throw result.value;
    }

    return this.toFileResponse(result.value.file, result.value.url);
  }

  @Delete(":id")
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("file.delete", "file.manage")
  @ApiHeader({ name: CAMPUS_ID_HEADER, required: true })
  @ApiOperation({ summary: "Soft delete a file" })
  async delete(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @CampusContext() campusId: string,
  ): Promise<void> {
    const result = await this.deleteFile.execute({
      fileId: new UniqueEntityID(id),
      campusId,
      deletedBy: user.id.toString(),
      canDeleteAny:
        isGlobalAdmin(user) ||
        user
          .getRolesForCampus(campusId)
          .some((role) => RoleEntity.hasPermissionById(role, "file.manage")),
    });

    if (result.isLeft()) {
      throw result.value;
    }
  }
}
