import { ApiProperty } from "@nestjs/swagger";
import { Expose } from "class-transformer";

export class InitiateUploadResponse {
  @ApiProperty({
    description: "The presigned URL to upload the file to.",
    example: "https://example.com/upload-url",
  })
  @Expose()
  uploadUrl: string;

  @ApiProperty({
    description: "The key of the file to be uploaded.",
    example: "path/to/file.jpg",
  })
  @Expose()
  key: string;
}
