import { ApiProperty } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";

import { StudentHealthInstructionType } from "@/domain/student-health";

export class ActiveHealthInstructionItemResponse {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  id: string;

  @Expose()
  @ApiProperty({
    enum: StudentHealthInstructionType,
    example: StudentHealthInstructionType.MEDICATION,
  })
  instructionType: StudentHealthInstructionType;

  @Expose()
  @ApiProperty({ example: "Antibiotic after lunch" })
  title: string;

  @Expose()
  @ApiProperty({ example: "Give the medication after lunch with water." })
  instruction: string;

  @Expose()
  @ApiProperty({ example: "5 ml", nullable: true })
  dosage: string | null;

  @Expose()
  @ApiProperty({ example: ["12:30"], type: [String] })
  timesOfDay: string[];

  @Expose()
  @ApiProperty({ example: "After lunch only.", nullable: true })
  scheduleNotes: string | null;

  @Expose()
  @ApiProperty({ example: "ACTIVE" })
  status: "ACTIVE";
}

export class ActiveStudentHealthInstructionsResponseDto {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174001" })
  studentId: string;

  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174002" })
  campusId: string;

  @Expose()
  @ApiProperty({ example: "2026-07-01" })
  date: string;

  @Expose()
  @Type(() => ActiveHealthInstructionItemResponse)
  @ApiProperty({ type: [ActiveHealthInstructionItemResponse] })
  instructions: ActiveHealthInstructionItemResponse[];
}

export class ActiveClassHealthInstructionStudentResponse {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174001" })
  id: string;

  @Expose()
  @ApiProperty({ example: "Alice Student" })
  fullName: string;

  @Expose()
  @ApiProperty({ example: "STU-001" })
  studentCode: string;
}

export class ActiveClassHealthInstructionItemResponse {
  @Expose()
  @Type(() => ActiveClassHealthInstructionStudentResponse)
  @ApiProperty({ type: ActiveClassHealthInstructionStudentResponse })
  student: ActiveClassHealthInstructionStudentResponse;

  @Expose()
  @Type(() => ActiveHealthInstructionItemResponse)
  @ApiProperty({ type: [ActiveHealthInstructionItemResponse] })
  instructions: ActiveHealthInstructionItemResponse[];
}

export class ActiveClassHealthInstructionsResponseDto {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174100" })
  classId: string;

  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174002" })
  campusId: string;

  @Expose()
  @ApiProperty({ example: "2026-07-01" })
  date: string;

  @Expose()
  @Type(() => ActiveClassHealthInstructionItemResponse)
  @ApiProperty({ type: [ActiveClassHealthInstructionItemResponse] })
  items: ActiveClassHealthInstructionItemResponse[];
}
