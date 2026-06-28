import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
  Type,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Observable } from "rxjs";
import { map } from "rxjs";
import {
  STANDARD_RESPONSE_KEY,
  StandardResponseOptions,
} from "../decorators/standard-response.decorator";
import { QueryValidatorService } from "../services/query-validator.service";
import { StandardRequest } from "../dto/standard-request.dto";
import { plainToInstance } from "class-transformer";
import { ValueObject } from "@/core/value-objects/value-object";

interface RequestWithQuery extends Request {
  query: Record<string, unknown>;
  standard_request?: StandardRequest;
}

interface StandardResponseData {
  success: boolean;
  message: string;
  data: unknown;
  pagination?: {
    limit: number;
    offset: number;
    total?: number;
    totalPages?: number;
  };
  timestamp: string;
}

interface PaginatedData {
  data: unknown;
  pagination: {
    limit: number;
    offset: number;
    total?: number;
    totalPages?: number;
  };
}

function isPaginatedData(data: unknown): data is PaginatedData {
  return (
    typeof data === "object" &&
    data !== null &&
    "data" in data &&
    "pagination" in data
  );
}

function isObjectWithSuccess(data: unknown): data is { success: boolean } {
  return typeof data === "object" && data !== null && "success" in data;
}

function isError(error: unknown): error is Error {
  return error instanceof Error;
}

function isValueObject(data: unknown): data is ValueObject<any> {
  return (
    typeof data === "object" && data !== null && data instanceof ValueObject
  );
}

@Injectable()
export class StandardResponseInterceptor<T = any> implements NestInterceptor {
  constructor(
    private reflector: Reflector,
    private queryValidatorService: QueryValidatorService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const options = this.reflector.get<StandardResponseOptions>(
      STANDARD_RESPONSE_KEY,
      context.getHandler(),
    );

    if (options) {
      const request = context.switchToHttp().getRequest<RequestWithQuery>();
      const query: Record<string, unknown> = request.query || {};

      if (query && Object.keys(query).length > 0) {
        try {
          this.queryValidatorService.validateQuery(query, {
            allowedSortFields: options.allowedSortFields,
            allowedFilterFields: options.allowedFilterFields,
            maxLimit: options.maxLimit,
            defaultLimit: options.defaultLimit,
          });

          const sanitizedQuery = this.queryValidatorService.sanitizeQuery(
            query,
            {
              defaultLimit: options.defaultLimit,
              maxLimit: options.maxLimit,
            },
          );

          const standardRequest: StandardRequest = {
            ...sanitizedQuery,
            allowedSortFields: options.allowedSortFields || [],
            allowedFilterFields: options.allowedFilterFields || [],
            defaultLimit: options.defaultLimit || 10,
            maxLimit: options.maxLimit || 50,
          };

          request.standard_request = standardRequest;
        } catch (error: unknown) {
          const errorMessage = isError(error)
            ? error.message
            : "Invalid query parameters";
          throw new BadRequestException(errorMessage);
        }
      }
    }

    return next.handle().pipe(
      map((data: unknown): unknown => {
        if (!options) {
          return data;
        }

        if (isObjectWithSuccess(data)) {
          return data;
        }

        // Process data to handle ValueObjects
        const processData = (input: unknown): unknown => {
          // Process ValueObjects using instanceof check
          if (isValueObject(input)) {
            const plainValue = input.toPlain();
            return plainValue;
          }

          // Preserve Date objects
          if (input instanceof Date) {
            return input;
          }

          // Process arrays
          if (Array.isArray(input)) {
            return input.map((item) => processData(item));
          }

          // Process Entity-like objects (objects with props and _id)
          if (
            typeof input === "object" &&
            input !== null &&
            !Array.isArray(input) &&
            "props" in input &&
            "_id" in input
          ) {
            // Flatten Entity structure: merge props with id
            const entity = input as any;
            const result: Record<string, unknown> = {
              id: entity._id.value || entity._id.toString(),
            };

            // Process props and add them directly to the result
            for (const [key, value] of Object.entries(entity.props)) {
              result[key] = processData(value);
            }

            // Also include getters that are not in props (like priceUsd)
            const entityPrototype = Object.getPrototypeOf(entity);
            const getterNames = Object.getOwnPropertyNames(
              entityPrototype,
            ).filter((name) => {
              const descriptor = Object.getOwnPropertyDescriptor(
                entityPrototype,
                name,
              );
              return (
                descriptor &&
                typeof descriptor.get === "function" &&
                name !== "constructor"
              );
            });

            for (const getterName of getterNames) {
              if (!(getterName in entity.props)) {
                try {
                  const getterValue = entity[getterName];
                  result[getterName] = processData(getterValue);
                } catch (error) {
                  // Skip getters that might throw errors
                }
              }
            }

            return result;
          }

          // Process regular objects
          if (
            typeof input === "object" &&
            input !== null &&
            !Array.isArray(input)
          ) {
            const result: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(input)) {
              result[key] = processData(value);
            }
            return result;
          }

          // Return primitives as is
          return input;
        };

        // First process ValueObjects
        const processedData = processData(data);

        // Get the DTO class from options if available
        let transformedData = processedData;
        const dtoClass = options?.type as Type<any>;

        // Auto transform if the type is a class constructor
        if (
          dtoClass &&
          typeof dtoClass === "function" &&
          typeof processedData === "object" &&
          processedData !== null
        ) {
          // Apply class-transformer to data based on its structure
          // Common transformation options
          const transformOptions = {
            excludeExtraneousValues: true,
            enableImplicitConversion: true,
            exposeUnsetFields: false,
            // Add this to ensure nested objects are also transformed
            enableCircularCheck: true,
          };

          // Helper function to transform Date objects to ISO strings
          const transformDates = (obj: any): any => {
            if (obj === null || obj === undefined) return obj;
            if (obj instanceof Date) {
              // Check if Date is valid before calling toISOString()
              return isNaN(obj.getTime()) ? null : obj.toISOString();
            }
            if (Array.isArray(obj)) return obj.map(transformDates);
            if (typeof obj === "object") {
              const transformed: any = {};
              for (const [key, value] of Object.entries(obj)) {
                transformed[key] = transformDates(value);
              }
              return transformed;
            }
            return obj;
          };

          if (Array.isArray(processedData)) {
            const transformedArray = transformDates(processedData);
            transformedData = plainToInstance(
              dtoClass,
              transformedArray,
              transformOptions,
            );
          } else if (
            "data" in processedData &&
            Array.isArray((processedData as any).data)
          ) {
            const transformedDataArray = transformDates(
              (processedData as any).data,
            );
            transformedData = {
              ...(processedData as any),
              data: plainToInstance(
                dtoClass,
                transformedDataArray,
                transformOptions,
              ),
            };
          } else {
            const transformedObject = transformDates(processedData);
            transformedData = plainToInstance(
              dtoClass,
              transformedObject,
              transformOptions,
            );
          }
        }

        if (options.isPaginated && isPaginatedData(transformedData)) {
          return {
            success: true,
            message: options.message || "Data retrieved successfully",
            data: transformedData.data,
            pagination: transformedData.pagination,
            timestamp: new Date().toISOString(),
          } as StandardResponseData;
        }

        if (isPaginatedData(transformedData)) {
          return {
            success: true,
            message: options.message || "Data retrieved successfully",
            data: transformedData.data,
            pagination: transformedData.pagination,
            timestamp: new Date().toISOString(),
          } as StandardResponseData;
        }

        if (Array.isArray(transformedData)) {
          return {
            success: true,
            message: options.message || "Data retrieved successfully",
            data: transformedData,
            timestamp: new Date().toISOString(),
          } as StandardResponseData;
        }

        return {
          success: true,
          message: options.message || "Data retrieved successfully",
          data: transformedData,
          timestamp: new Date().toISOString(),
        } as StandardResponseData;
      }),
    );
  }
}
