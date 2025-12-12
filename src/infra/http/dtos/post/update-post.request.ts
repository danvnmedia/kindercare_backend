import {
  IsEnum,
  IsString,
  MinLength,
  IsOptional,
  IsDate,
  IsArray,
  ValidateNested,
  IsUUID,
} from "class-validator";
import { Type } from "class-transformer";
import { PostStatus, AudienceType } from "@/domain/content-management";

class UpdateAudienceDto {
  @IsEnum(AudienceType)
  audienceType: AudienceType;

  @IsUUID()
  audienceId: string;
}

export class UpdatePostRequest {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsEnum(PostStatus)
  status?: PostStatus;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  publishAt?: Date;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateAudienceDto)
  audiences?: UpdateAudienceDto[];
}
