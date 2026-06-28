import { ApiProperty } from "@nestjs/swagger";
import { ArrayNotEmpty, IsArray, IsString } from "class-validator";

export class AssignPermissionsRequest {
  @ApiProperty({
    description: "Permission IDs to assign",
    example: ["student.create", "student.read", "student.update"],
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  permissionIds: string[];
}
