import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Expose, Transform } from "class-transformer";
import { FileStatus } from "@/domain/file-management/enums/file-status.enum";
import { FilePurpose } from "@/domain/file-management/enums/file-purpose.enum";
import { FileAudienceType } from "@/domain/file-management/enums/file-audience-type.enum";

export class FileResponse {
  @ApiProperty({
    description: "The ID of the file.",
    example: "c6a8a9b4-7f1a-4f5f-8a9a-9b4a7f1a4f5f",
  })
  @Expose()
  id: string;

  @ApiProperty({
    description: "The ID of the campus where the file belongs.",
    example: "c6a8a9b4-7f1a-4f5f-8a9a-9b4a7f1a4f5f",
  })
  @Expose()
  campusId: string;

  @ApiProperty({
    description: "The key (S3 path) of the file.",
    example: "files/campus-id/post/ALL/uuid-file.jpg",
  })
  @Expose()
  key: string;

  @ApiPropertyOptional({
    description: "The S3 bucket name where the file is stored.",
    example: "kindercare-uploads",
  })
  @Expose()
  bucket: string | null;

  @ApiProperty({
    description: "The storage provider (S3, GCS, LOCAL).",
    example: "LOCAL",
  })
  @Expose()
  storageProvider: string;

  @ApiProperty({
    description: "The original filename.",
    example: "photo.jpg",
  })
  @Expose()
  filename: string;

  @ApiProperty({
    description: "The MIME type of the file.",
    example: "image/jpeg",
  })
  @Expose()
  mimeType: string;

  @ApiProperty({
    description: "The size of the file in bytes.",
    example: 123456,
  })
  @Expose()
  @Transform(({ value }) => (typeof value === "bigint" ? Number(value) : value))
  size: number;

  @ApiPropertyOptional({
    description: "The file extension (without dot).",
    example: "jpg",
  })
  @Expose()
  extension: string | null;

  @ApiPropertyOptional({
    description: "SHA-256 hash of the file content.",
    example: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  })
  @Expose()
  contentHash: string | null;

  @ApiProperty({
    description: "The purpose/category of the file.",
    enum: FilePurpose,
    example: FilePurpose.POST_ATTACHMENT,
  })
  @Expose()
  purpose: FilePurpose;

  @ApiPropertyOptional({
    description: "The audience type for file visibility scope.",
    enum: FileAudienceType,
    example: FileAudienceType.ALL,
  })
  @Expose()
  audienceType: FileAudienceType | null;

  @ApiPropertyOptional({
    description: "The specific audience ID (class/grade/student UUID).",
    example: "c6a8a9b4-7f1a-4f5f-8a9a-9b4a7f1a4f5f",
  })
  @Expose()
  audienceId: string | null;

  @ApiPropertyOptional({
    description: "The class ID if file is scoped to a class.",
    example: "c6a8a9b4-7f1a-4f5f-8a9a-9b4a7f1a4f5f",
  })
  @Expose()
  classId: string | null;

  @ApiPropertyOptional({
    description: "The grade level ID if file is scoped to a grade.",
    example: "c6a8a9b4-7f1a-4f5f-8a9a-9b4a7f1a4f5f",
  })
  @Expose()
  gradeLevelId: string | null;

  @ApiProperty({
    description: "The status of the file.",
    enum: FileStatus,
    example: FileStatus.UPLOADED,
  })
  @Expose()
  status: FileStatus;

  @ApiProperty({
    description: "Whether the file has been soft-deleted.",
    example: false,
  })
  @Expose()
  isDeleted: boolean;

  @ApiProperty({
    description: "The ID of the user who uploaded the file.",
    example: "c6a8a9b4-7f1a-4f5f-8a9a-9b4a7f1a4f5f",
  })
  @Expose()
  uploadedBy: string;

  @ApiProperty({
    description: "The date the file was created.",
    example: "2021-01-01T00:00:00.000Z",
  })
  @Expose()
  createdAt: Date;

  @ApiProperty({
    description: "The date the file was last updated.",
    example: "2021-01-01T00:00:00.000Z",
  })
  @Expose()
  updatedAt: Date;
}
