import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsNumber,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
} from "class-validator";

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

  @ApiPropertyOptional({
    description: "Storage provider (defaults to LOCAL)",
    enum: ["S3", "GCS", "LOCAL"],
    default: "LOCAL",
  })
  @IsOptional()
  @IsIn(["S3", "GCS", "LOCAL"])
  storageProvider?: string;
}
