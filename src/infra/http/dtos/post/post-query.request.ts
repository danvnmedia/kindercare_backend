import { IsOptional, IsEnum, IsUUID } from "class-validator";
import { StandardRequestDto } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PostStatus } from "@/domain/content-management";

export class PostQueryRequest extends StandardRequestDto {
  @IsOptional()
  @IsEnum(PostStatus)
  status?: PostStatus;

  @IsOptional()
  @IsUUID()
  authorId?: string;
}
