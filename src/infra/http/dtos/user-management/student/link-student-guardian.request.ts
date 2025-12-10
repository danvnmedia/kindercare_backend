import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsUUID } from 'class-validator';

export enum GuardianRelationshipType {
  FATHER = 'FATHER',
  MOTHER = 'MOTHER',
  GUARDIAN = 'GUARDIAN',
}

export class LinkStudentGuardianRequest {
  @ApiProperty({
    description: 'Guardian ID to link',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  @IsNotEmpty()
  @IsUUID('4', { message: 'Guardian ID must be a valid UUID' })
  guardianId: string;

  @ApiProperty({
    description: 'Relationship type between student and guardian',
    enum: GuardianRelationshipType,
    example: GuardianRelationshipType.FATHER,
  })
  @IsNotEmpty()
  @IsEnum(GuardianRelationshipType, {
    message: 'Relationship must be FATHER, MOTHER, or GUARDIAN',
  })
  relationshipId: GuardianRelationshipType;
}
