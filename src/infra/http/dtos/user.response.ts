import { ApiProperty } from "@nestjs/swagger";
import { Expose, Transform } from "class-transformer";
import { User } from "@/domain/user-management/user.entity";
import { Guardian } from "@/domain/user-management/guardian.entity";
import { Teacher } from "@/domain/user-management/teacher.entity";

export class UserResponse {
  @ApiProperty({
    example: "550e8400-e29b-41d4-a716-446655440000",
    description: "User ID (UUID)",
  })
  @Expose()
  @Transform(({ value }) => value.toString())
  id: string;

  @ApiProperty({ example: "John Doe", description: "User name" })
  @Expose()
  @Transform(
    ({ obj }: { obj: User & { guardian?: Guardian; teacher?: Teacher } }) => {
      if (obj.guardian) return obj.guardian.fullName;
      if (obj.teacher) return obj.teacher.fullName;
      return "Unknown";
    },
    { toClassOnly: true },
  )
  name: string;

  @ApiProperty({ example: "john@example.com", description: "User email" })
  @Expose()
  @Transform(
    ({ obj }: { obj: User & { guardian?: Guardian; teacher?: Teacher } }) => {
      if (obj.guardian) return obj.guardian.email;
      if (obj.teacher) return obj.teacher.email;
      return "unknown@example.com";
    },
    { toClassOnly: true },
  )
  email: string;

  @ApiProperty({
    example: "2023-01-01T00:00:00.000Z",
    description: "Created date",
  })
  @Expose()
  createdAt: Date;

  @ApiProperty({
    example: "2023-01-01T00:00:00.000Z",
    description: "Updated date",
  })
  @Expose()
  updatedAt: Date;
}
