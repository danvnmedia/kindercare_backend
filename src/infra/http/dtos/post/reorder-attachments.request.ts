import { IsArray, ValidateNested, IsUUID, IsNumber } from "class-validator";
import { Type } from "class-transformer";

class OrderDto {
  @IsUUID()
  id: string;

  @IsNumber()
  order: number;
}
export class ReorderAttachmentsRequest {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderDto)
  orders: OrderDto[];
}
