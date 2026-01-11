import { ApiProperty } from "@nestjs/swagger";
import { IsNumber, IsString, IsNotEmpty, IsUUID } from "class-validator";

export class InitiateUploadRequest {
  @ApiProperty({ description: "Original filename" })
  @IsString()
  @IsNotEmpty()
  filename: string;

  @ApiProperty({ description: "MIME type of the file" })
  @IsString()
  @IsNotEmpty()
  mimeType: string;

  @ApiProperty({ description: "Size of the file in bytes" })
  @IsNumber()
  size: number;

  @ApiProperty({ description: "Campus ID where the file belongs" })
  @IsUUID()
  @IsNotEmpty()
  campusId: string;
}
