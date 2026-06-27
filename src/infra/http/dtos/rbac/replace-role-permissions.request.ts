import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsString } from "class-validator";

export class ReplaceRolePermissionsRequest {
  @ApiProperty({
    description:
      "Final permission ID set for the role. Send an empty array to remove all permissions.",
    example: ["student.create", "student.read", "student.update"],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  permissionIds: string[];
}
