import { SetMetadata } from "@nestjs/common";
import { ApiQuery, ApiResponse } from "@nestjs/swagger";
import { createStandardResponseClass } from "../dto/standard-response.dto";

type ResponseDataType = new (...args: unknown[]) => unknown;

export interface StandardResponseOptions {
  type: ResponseDataType | string | null | undefined;
  message?: string;
  isPaginated?: boolean;
  isArray?: boolean;
  defaultLimit?: number;
  maxLimit?: number;
  allowedSortFields?: string[];
  allowedFilterFields?: string[];
}

export const STANDARD_RESPONSE_KEY = "standard_response";

export function StandardResponse(options: StandardResponseOptions) {
  return function <T extends object>(
    target: T,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor {
    SetMetadata(STANDARD_RESPONSE_KEY, options)(
      target as object,
      propertyKey,
      descriptor,
    );

    const message = options.message || "Operation completed successfully";
    const isPaginated = options.isPaginated || false;
    const isArray = options.isArray || false;
    const allowedSortFields = options.allowedSortFields || [];
    const allowedFilterFields = options.allowedFilterFields || [];
    const defaultLimit = options.defaultLimit || 20;
    const maxLimit = options.maxLimit || 50;

    const ResponseClass = createStandardResponseClass(
      options.type,
      isPaginated,
      isArray,
    );

    ApiResponse({
      status: 200,
      description: message,
      type: ResponseClass,
    })(target as object, propertyKey, descriptor);

    if (isPaginated) {
      ApiQuery({
        name: "limit",
        required: false,
        type: Number,
        description: "Number of items to return",
        example: defaultLimit,
      })(target as object, propertyKey, descriptor);

      ApiQuery({
        name: "offset",
        required: false,
        type: Number,
        description: `Number of items to skip (max: ${maxLimit})`,
        example: 0,
      })(target as object, propertyKey, descriptor);
    }

    if (allowedSortFields && allowedSortFields.length > 0) {
      ApiQuery({
        name: "sort",
        required: false,
        type: String,
        description: `Sort fields:\n
- Array of string - comma separated\n
- Prefix with - for descending order\n
- Allowed fields: ${allowedSortFields.join(", ")}\n
- Example: -${allowedSortFields[0]},${allowedSortFields[1] || allowedSortFields[0]}`,
        example: `-${allowedSortFields[0]},${allowedSortFields[1] || allowedSortFields[0]}`,
      })(target as object, propertyKey, descriptor);
    }

    if (allowedFilterFields && allowedFilterFields.length > 0) {
      ApiQuery({
        name: "filter",
        required: false,
        type: String,
        description: `Filter object (JSON string format).\n
- Each field can be:\n
  - Simple value: "field": "value"\n
  - Complex conditions: "field": {"eq": "value", "in": ["v1","v2"], "gte": 100, "like": "search"}\n
- Available operators: eq, ne, gt, gte, lt, lte, like, ilike, in, not_in, between\n
- Allowed fields: ${allowedFilterFields.join(", ")}`,
        example: JSON.stringify(
          {
            [allowedFilterFields[0]]: "example",
          },
          null,
          2,
        ),
      })(target as object, propertyKey, descriptor);
    }

    return descriptor;
  };
}
