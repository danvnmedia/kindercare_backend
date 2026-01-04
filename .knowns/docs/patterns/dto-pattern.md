---
title: DTO Pattern
createdAt: '2026-01-03T19:52:14.788Z'
updatedAt: '2026-01-03T20:07:56.945Z'
description: Request/Response validation pattern
tags:
  - patterns
  - dto
  - validation
---
# DTO Pattern

## Overview

DTOs (Data Transfer Objects) handle data transformation between HTTP layer and application layer. There are two types: Request DTOs for input validation and Response DTOs for output transformation.

## Locations

- Request: src/infra/http/dtos/{module}/{action}-{entity}.request.ts
- Response: src/infra/http/dtos/{module}/{entity}.response.ts

## Request DTO

Uses class-validator decorators for validation and class-transformer for transformation.

### Common Decorators

Validation:
- @IsString(), @IsEmail(), @IsEnum(EnumType)
- @IsNotEmpty(), @IsOptional()
- @MinLength(n), @MaxLength(n)
- @IsUUID(), @IsDate(), @IsArray()
- @ValidateNested({ each: true })

Custom:
- @IsE164Phone() - Phone number format
- @IsAdultDateOfBirth() - Age validation
- @TransformToUTCDate() - Date transformation
- @IsISO8601Date() - ISO date format

Swagger:
- @ApiProperty({ description, example, required, enum })

### Example Request DTO

import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Gender } from '@/domain/user-management/enums/gender.enum';
import { StaffType } from '@/domain/user-management/enums/staff-type.enum';
import { IsE164Phone, IsAdultDateOfBirth, TransformToUTCDate } from '@/core/validators';

export class CreateStaffRequest {
  @ApiProperty({ description: 'Staff full name', example: 'John Doe', minLength: 2, maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  fullName: string;

  @ApiProperty({ description: 'Staff email', example: 'staff@example.com' })
  @IsNotEmpty()
  @IsEmail({}, { message: 'Invalid email format' })
  email: string;

  @ApiProperty({ description: 'Staff phone number', example: '+84912345678' })
  @IsNotEmpty()
  @IsString()
  @IsE164Phone()
  phoneNumber: string;

  @ApiProperty({ description: 'Staff type', enum: StaffType, example: StaffType.TEACHER })
  @IsNotEmpty()
  @IsEnum(StaffType, { message: 'Staff type must be TEACHER, NURSE, PRINCIPAL, or STAFF' })
  staffType: StaffType;

  @ApiProperty({ description: 'Date of birth', example: '1990-01-15T00:00:00.000Z', required: false })
  @IsOptional()
  @TransformToUTCDate()
  @IsAdultDateOfBirth()
  dateOfBirth?: Date;
}

### Nested Validation

For nested objects, use @ValidateNested with @Type:

import { ValidateNested, IsArray, IsEnum, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

class CreateAudienceDto {
  @IsEnum(AudienceType)
  audienceType: AudienceType;

  @IsUUID()
  audienceId: string;
}

export class CreatePostRequest {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAudienceDto)
  audiences: CreateAudienceDto[];
}

## Response DTO

Uses class-transformer decorators for serialization.

### Required Decorators

- @Expose() - Include property in response (required for all fields)
- @Type(() => NestedDto) - Transform nested objects

### Example Response DTO

import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

export class StaffResponse {
  @Expose()
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @Expose()
  @ApiProperty({ example: 'John Doe' })
  fullName: string;

  @Expose()
  @ApiProperty({ example: 'staff@example.com' })
  email: string;

  @Expose()
  @ApiProperty({ example: 'TEACHER', description: 'Staff type' })
  staffType: string;

  @Expose()
  @ApiProperty({ example: '1990-01-15T00:00:00.000Z', nullable: true })
  dateOfBirth: Date | null;

  @Expose()
  @ApiProperty({ example: false })
  isArchived: boolean;

  @Expose()
  @ApiProperty({ example: '2025-01-01T00:00:00.000Z' })
  createdAt: Date;
}

### Nested Response DTO

export class PostResponse {
  @Expose()
  id: string;

  @Expose()
  @Type(() => UserResponse)
  author: UserResponse;

  @ApiProperty({ type: [AttachmentResponse] })
  @Type(() => AttachmentResponse)
  @Expose()
  attachments: AttachmentResponse[];
}

## Best Practices

1. Group related fields with comments in Request DTOs
2. Use @Expose() on EVERY Response DTO property
3. Provide meaningful @ApiProperty examples for Swagger
4. Use custom validators for complex rules
5. Use @Type() for nested objects in both Request and Response
6. Handle nullable fields: Date | null with nullable: true in ApiProperty
7. Separate Request and Response DTOs - never reuse
8. Use enums from domain layer in DTOs
