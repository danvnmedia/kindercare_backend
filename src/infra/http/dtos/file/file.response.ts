import { ApiProperty } from "@nestjs/swagger";
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
    description: "The key of the file.",
    example: "path/to/file.jpg",
  })
  @Expose()
  key: string;

  @ApiProperty({
    description: "The name of the file.",
    example: "file.jpg",
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

  @ApiProperty({
    description: "The status of the file.",
    enum: FileStatus,
    example: FileStatus.ACTIVE,
  })
  @Expose()
  status: FileStatus;

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
