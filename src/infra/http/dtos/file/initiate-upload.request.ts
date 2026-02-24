import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsNumber,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  IsEnum,
  IsUUID,
} from "class-validator";
import { FilePurpose } from "@/domain/file-management/enums/file-purpose.enum";
import { FileAudienceType } from "@/domain/file-management/enums/file-audience-type.enum";

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
    description:
      "Storage provider (defaults to LOCAL, R2 uses S3-compatible API)",
    enum: ["S3", "R2", "GCS", "LOCAL"],
    default: "LOCAL",
  })
  @IsOptional()
  @IsIn(["S3", "R2", "GCS", "LOCAL"])
  storageProvider?: string;

  @ApiPropertyOptional({
    description: "Purpose of the file upload",
    enum: FilePurpose,
    default: FilePurpose.GENERAL,
  })
  @IsOptional()
  @IsEnum(FilePurpose)
  purpose?: FilePurpose;

  @ApiPropertyOptional({
    description:
      "Audience type for file visibility scope (mirrors post audience). Required for POST_ATTACHMENT purpose.",
    enum: FileAudienceType,
  })
  @IsOptional()
  @IsEnum(FileAudienceType)
  audienceType?: FileAudienceType;

  @ApiPropertyOptional({
    description:
      "The specific audience ID (class/grade/student UUID). Required when audienceType is CLASS, GRADE, or STUDENT.",
  })
  @IsOptional()
  @IsUUID()
  audienceId?: string;
}
