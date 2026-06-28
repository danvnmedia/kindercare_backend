import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Expose } from "class-transformer";
import { FileStatus } from "@/domain/file-management/enums/file-status.enum";

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
    example: "files/campus-id/uuid-file.jpg",
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
  size: bigint;

  @ApiPropertyOptional({
    description: "The file extension (without dot).",
    example: "jpg",
  })
  @Expose()
  extension: string | null;

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
