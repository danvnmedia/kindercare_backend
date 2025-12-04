import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

export class ChildInfo {
  @Expose()
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  studentId: string;

  @Expose()
  @ApiProperty({ example: 'Nguyễn Văn A' })
  fullName: string;

  @Expose()
  @ApiProperty({ example: 'Bé A', nullable: true })
  nickname: string | null;

  @Expose()
  @ApiProperty({ example: 'Lớp Mầm 1A', nullable: true })
  className: string | null;

  @Expose()
  @ApiProperty({ example: 'FATHER' })
  relationship: string;

  @Expose()
  @ApiProperty({ example: 'Cha' })
  relationshipName: string;
}

export class GuardianSpouseInfo {
  @Expose()
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174001' })
  id: string;

  @Expose()
  @ApiProperty({ example: 'Nguyễn Văn C' })
  fullName: string;

  @Expose()
  @ApiProperty({ example: 'spouse@example.com', nullable: true })
  email: string | null;

  @Expose()
  @ApiProperty({ example: '+84912345679', nullable: true })
  phoneNumber: string | null;
}

export class GuardianResponse {
  @Expose()
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  // Personal information (now stored directly in Guardian)
  @Expose()
  @ApiProperty({ example: 'Nguyễn Thị B' })
  fullName: string;

  @Expose()
  @ApiProperty({ example: 'guardian@example.com' })
  email: string;

  @Expose()
  @ApiProperty({ example: '+84912345678' })
  phoneNumber: string;

  @Expose()
  @ApiProperty({ example: '123 Đường ABC, Quận 1, TP.HCM', nullable: true })
  address: string | null;

  @Expose()
  @ApiProperty({ example: '1985-03-20T00:00:00.000Z' })
  dateOfBirth: Date;

  @Expose()
  @ApiProperty({ example: 'FEMALE', nullable: true })
  gender: string | null;

  // Guardian-specific data
  @Expose()
  @ApiProperty({ example: 'Software Engineer', nullable: true })
  occupation: string | null;

  @Expose()
  @ApiProperty({ example: '456 Đường XYZ, Quận 3, TP.HCM', nullable: true })
  workAddress: string | null;

  @Expose()
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174001', nullable: true })
  spouseId: string | null;

  @Expose()
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174002', nullable: true })
  userId: string | null;

  @Expose()
  @ApiProperty({ example: false })
  isArchived: boolean;

  // Relations
  @Expose()
  @Type(() => GuardianSpouseInfo)
  @ApiProperty({ type: GuardianSpouseInfo, nullable: true, required: false })
  spouse?: GuardianSpouseInfo | null;

  @Expose()
  @Type(() => ChildInfo)
  @ApiProperty({ type: [ChildInfo], required: false })
  children?: ChildInfo[];

  @Expose()
  @ApiProperty({ example: '2025-11-26T00:00:00.000Z' })
  createdAt: Date;

  @Expose()
  @ApiProperty({ example: '2025-11-26T00:00:00.000Z' })
  updatedAt: Date;
}
