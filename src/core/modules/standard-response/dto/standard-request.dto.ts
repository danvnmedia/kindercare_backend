import { ApiProperty } from "@nestjs/swagger";
import {
  IsOptional,
  IsString,
  IsNumber,
  IsArray,
  IsObject,
} from "class-validator";
import { FilterSchemaDto, SortSchemaDto } from "./filter-schema.dto";

export enum SortOrder {
  ASC = "asc",
  DESC = "desc",
}

export enum FilterOperator {
  EQ = "eq",
  NE = "ne",
  GT = "gt",
  GTE = "gte",
  LT = "lt",
  LTE = "lte",
  LIKE = "like",
  ILIKE = "ilike",
  IN = "in",
  NOT_IN = "not_in",
  BETWEEN = "between",
  CONTAINS = "contains",
  STARTS_WITH = "starts_with",
  ENDS_WITH = "ends_with",
}

export class StandardRequestDto {
  @ApiProperty({
    description: "Number of items to return",
    example: 10,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  limit?: number;

  @ApiProperty({
    description: "Number of items to skip",
    example: 0,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  offset?: number;

  @ApiProperty({
    description: "Sort fields (comma separated, prefix with - for desc)",
    example: "-rating,price",
    required: false,
  })
  @IsOptional()
  @IsString()
  sort?: string;

  @ApiProperty({
    description: "Filter object (JSON format)",
    example:
      '{"email":{"in":["user1","user2"]},"role":"admin","price":{"gte":100,"lte":1000}}',
    required: false,
  })
  @IsOptional()
  @IsString()
  filter?: string;

  @IsOptional()
  @IsObject()
  filterInfo?: FilterSchemaDto;

  @IsOptional()
  @IsObject()
  sortInfo?: SortSchemaDto;

  @IsOptional()
  @IsArray()
  allowedSortFields?: string[] = [];

  @IsOptional()
  @IsArray()
  allowedFilterFields?: string[] = [];

  @IsOptional()
  @IsNumber()
  defaultLimit?: number = 10;

  @IsOptional()
  @IsNumber()
  maxLimit?: number = 50;
}

// Alias to preserve existing imports
export type StandardRequest = StandardRequestDto;
