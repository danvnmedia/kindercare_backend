import { ApiProperty } from "@nestjs/swagger";
import { Expose, Transform } from "class-transformer";
import { User } from "@/domain/user-management/user.entity";

export class UserResponse {
  @ApiProperty({
    example: "550e8400-e29b-41d4-a716-446655440000",
    description: "User ID (UUID)",
  })
  @Expose()
  id: string;

  @ApiProperty({ example: "John Doe", description: "User name" })
  @Expose()
  @Transform(
    ({ obj }: { obj: User }) => {
      // Use the profile from the User entity (which contains guardian or staff info)
      if (obj.profile?.fullName) return obj.profile.fullName;
      return "Unknown";
    },
    { toClassOnly: true },
  )
  name: string;

  @ApiProperty({ example: "john@example.com", description: "User email" })
  @Expose()
  @Transform(
    ({ obj }: { obj: User }) => {
      // Use the profile from the User entity (which contains guardian or staff info)
      if (obj.profile?.email) return obj.profile.email;
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
