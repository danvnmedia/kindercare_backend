import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";

export class RoleMemberProfileResponse {
  @Expose()
  @ApiPropertyOptional({
    enum: ["staff", "guardian"],
    nullable: true,
    example: "staff",
  })
  type: "staff" | "guardian" | null;

  @Expose()
  @ApiPropertyOptional({
    nullable: true,
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  id: string | null;

  @Expose()
  @ApiPropertyOptional({ nullable: true, example: "Alice Nguyen" })
  fullName: string | null;

  @Expose()
  @ApiPropertyOptional({ nullable: true, example: "alice@example.com" })
  email: string | null;

  @Expose()
  @ApiPropertyOptional({ nullable: true, example: "+1 555 0100" })
  phoneNumber: string | null;

  @Expose()
  @ApiPropertyOptional({
    nullable: true,
    example: "1990-01-01T00:00:00.000Z",
  })
  dateOfBirth: Date | null;
}

export class RoleMemberProvenanceResponse {
  @Expose()
  @ApiProperty({
    enum: ["manual", "staff_type"],
    example: "staff_type",
  })
  source: "manual" | "staff_type";

  @Expose()
  @ApiPropertyOptional({
    nullable: true,
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  grantedViaStaffTypeId: string | null;

  @Expose()
  @ApiPropertyOptional({ nullable: true, example: "Teacher" })
  staffTypeName: string | null;

  @Expose()
  @ApiProperty({
    description:
      "Whether admin revoke is allowed to remove this specific assignment row.",
    example: true,
  })
  canOverride: boolean;

  @Expose()
  @ApiPropertyOptional({
    nullable: true,
    example:
      "This grant came from a StaffType default role. Revoking it here removes the current tracked grant, but future staff-type changes may grant it again if that StaffType still defaults to this role.",
  })
  warning: string | null;
}

export class RoleMemberResponse {
  @Expose()
  @ApiProperty({ example: "550e8400-e29b-41d4-a716-446655440001" })
  assignmentId: string;

  @Expose()
  @ApiProperty({ example: "550e8400-e29b-41d4-a716-446655440002" })
  userId: string;

  @Expose()
  @ApiProperty({ example: "user_2abc123" })
  clerkUid: string;

  @Expose()
  @ApiProperty({ example: true })
  isActive: boolean;

  @Expose()
  @ApiProperty({ example: "550e8400-e29b-41d4-a716-446655440000" })
  campusId: string | null;

  @Expose()
  @ApiProperty({ example: "2026-06-26T12:00:00.000Z" })
  assignedAt: Date;

  @Expose()
  @Type(() => RoleMemberProfileResponse)
  @ApiProperty({ type: RoleMemberProfileResponse })
  profile: RoleMemberProfileResponse;

  @Expose()
  @Type(() => RoleMemberProvenanceResponse)
  @ApiProperty({ type: RoleMemberProvenanceResponse })
  provenance: RoleMemberProvenanceResponse;
}
