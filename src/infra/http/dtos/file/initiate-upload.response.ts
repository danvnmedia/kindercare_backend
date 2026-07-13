import { ApiProperty } from "@nestjs/swagger";
import { Expose } from "class-transformer";

export class InitiateUploadResponse {
  @ApiProperty({
    description: "The ID of the file record created.",
    example: "c6a8a9b4-7f1a-4f5f-8a9a-9b4a7f1a4f5f",
  })
  @Expose()
  fileId: string;

  @ApiProperty({
    description: "The presigned URL to upload the file to.",
    example: "https://example.com/upload-url",
  })
  @Expose()
  uploadUrl: string;

  @ApiProperty({
    description: "The key of the file in storage.",
    example: "files/campus-id/post_attachment/all/file-id-filename.jpg",
  })
  @Expose()
  key: string;
}
