import { IsString, IsUUID, IsOptional } from "class-validator";

export class AddAttachmentRequest {
  @IsUUID()
  fileId: string;

  @IsOptional()
  @IsString()
  comment?: string;
}
