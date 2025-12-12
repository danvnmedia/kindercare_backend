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
import { PostType, AudienceType } from "@/domain/content-management";

class CreateAudienceDto {
  @IsEnum(AudienceType)
  audienceType: AudienceType;

  @IsUUID()
  audienceId: string;
}

export class CreatePostRequest {
  @IsEnum(PostType)
  type: PostType;

  @IsString()
  @MinLength(1)
  title: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  publishAt?: Date;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAudienceDto)
  audiences: CreateAudienceDto[];
}
