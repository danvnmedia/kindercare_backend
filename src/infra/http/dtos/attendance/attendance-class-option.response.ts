import { ApiProperty } from "@nestjs/swagger";
import { Expose } from "class-transformer";

import { AttendanceClassOptionView } from "@/application/attendance/ports/attendance-class-options.repository";

export class AttendanceClassOptionResponse
  implements AttendanceClassOptionView
{
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  id: string;

  @Expose()
  @ApiProperty({ example: "Sunflower A" })
  name: string;

  @Expose()
  @ApiProperty({ example: null, nullable: true })
  code: string | null;
}
