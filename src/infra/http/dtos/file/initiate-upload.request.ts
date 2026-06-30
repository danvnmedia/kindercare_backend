import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsNumber,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsUUID,
  ValidateIf,
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
    description: "Purpose of the file upload",
    enum: FilePurpose,
    default: FilePurpose.GENERAL,
  })
  @IsOptional()
  @IsEnum(FilePurpose)
  purpose?: FilePurpose;

  @ApiPropertyOptional({
    description:
      "Optional audience type for storage grouping. Omit or use ALL for campus-wide uploads; use CLASS for class-scoped uploads.",
    enum: FileAudienceType,
  })
  @ValidateIf(
    (request: InitiateUploadRequest) => request.audienceType !== undefined,
  )
  @IsNotEmpty()
  @IsEnum(FileAudienceType)
  audienceType?: FileAudienceType;

  @ApiPropertyOptional({
    description:
      "The specific class UUID. Required when audienceType is CLASS.",
  })
  @ValidateIf(
    (request: InitiateUploadRequest) =>
      request.audienceType === FileAudienceType.CLASS ||
      request.audienceId !== undefined,
  )
  @IsNotEmpty()
  @IsUUID()
  audienceId?: string;
}
