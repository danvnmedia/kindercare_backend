import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

export class ClassInfo {
  @Expose()
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @Expose()
  @ApiProperty({ example: 'Lớp Mầm 1A' })
  name: string;
}

export class GuardianInfo {
  @Expose()
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @Expose()
  @ApiProperty({ example: 'Nguyễn Thị B' })
  fullName: string;

  @Expose()
  @ApiProperty({ example: 'MOTHER' })
  relationship: string;

  @Expose()
  @ApiProperty({ example: 'guardian@example.com', nullable: true })
  email: string | null;

  @Expose()
  @ApiProperty({ example: '+84912345678', nullable: true })
  phoneNumber: string | null;
}

export class StudentResponse {
  @Expose()
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @Expose()
  @ApiProperty({ example: 'STU-2025-0001' })
  studentCode: string;

  // Personal information (now stored directly in Student)
  @Expose()
  @ApiProperty({ example: 'Nguyễn Văn A' })
  fullName: string;

  @Expose()
  @ApiProperty({ example: 'student@example.com', nullable: true })
  email: string | null;

  @Expose()
  @ApiProperty({ example: '+84912345678', nullable: true })
  phoneNumber: string | null;

  @Expose()
  @ApiProperty({ example: '123 Đường ABC, Quận 1, TP.HCM', nullable: true })
  address: string | null;

  @Expose()
  @ApiProperty({ example: '2018-05-15T00:00:00.000Z', nullable: true })
  dateOfBirth: Date | null;

  // Student-specific data
  @Expose()
  @ApiProperty({ example: 'Bé A', nullable: true })
  nickname: string | null;

  @Expose()
  @ApiProperty({ example: 'MALE', nullable: true })
  gender: string | null;

  @Expose()
  @ApiProperty({
    example: 'WAITING',
    description: 'Student status: WAITING, ACTIVE, INACTIVE, GRADUATED',
  })
  status: string;

  @Expose()
  @ApiProperty({ example: '2025-01-15T00:00:00.000Z', nullable: true })
  enrollmentDate: Date | null;

  @Expose()
  @ApiProperty({ example: true })
  isOnTrack: boolean;

  @Expose()
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000', nullable: true })
  classId: string | null;

  @Expose()
  @ApiProperty({ example: false })
  isArchived: boolean;

  // Relations
  @Expose()
  @Type(() => ClassInfo)
  @ApiProperty({ type: ClassInfo, nullable: true })
  class?: ClassInfo | null;

  @Expose()
  @Type(() => GuardianInfo)
  @ApiProperty({ type: [GuardianInfo], required: false })
  guardians?: GuardianInfo[];

  @Expose()
  @ApiProperty({ example: '2025-11-26T00:00:00.000Z' })
  createdAt: Date;

  @Expose()
  @ApiProperty({ example: '2025-11-26T00:00:00.000Z' })
  updatedAt: Date;
}
