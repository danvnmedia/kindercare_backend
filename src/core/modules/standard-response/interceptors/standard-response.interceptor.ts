import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
    BadRequestException,
    Type,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
    STANDARD_RESPONSE_KEY,
    StandardResponseOptions,
} from '../decorators/standard-response.decorator';
import { QueryValidatorService } from '../services/query-validator.service';
import { StandardRequest } from '../dto/standard-request.dto';
import { plainToInstance } from 'class-transformer';

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
        typeof data === 'object' &&
        data !== null &&
        'data' in data &&
        'pagination' in data
    );
}

function isObjectWithSuccess(data: unknown): data is { success: boolean } {
    return typeof data === 'object' && data !== null && 'success' in data;
}

function isError(error: unknown): error is Error {
    return error instanceof Error;
}

@Injectable()
export class StandardResponseInterceptor<T = any> implements NestInterceptor {
    constructor(
        private reflector: Reflector,
        private queryValidatorService: QueryValidatorService,
    ) { }

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
                        : 'Invalid query parameters';
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

                // Get the DTO class from options if available
                let transformedData = data;
                const dtoClass = options?.type as Type<any>;

                // Auto transform if the type is a class constructor
                if (dtoClass && typeof dtoClass === 'function' && typeof data === 'object' && data !== null) {
                    // Apply class-transformer to data based on its structure
                    // Common transformation options
                    const transformOptions = {
                        excludeExtraneousValues: true,
                        enableImplicitConversion: true,
                        exposeUnsetFields: false,
                        // Add this to ensure nested objects are also transformed
                        enableCircularCheck: true,
                    };

                    if (Array.isArray(data)) {
                        transformedData = plainToInstance(dtoClass, data, transformOptions);
                    } else if ('data' in data && Array.isArray((data as any).data)) {
                        transformedData = {
                            ...(data as any),
                            data: plainToInstance(dtoClass, (data as any).data, transformOptions),
                        };
                    } else {
                        transformedData = plainToInstance(dtoClass, data, transformOptions);
                    }
                }

                if (options.isPaginated && isPaginatedData(transformedData)) {
                    return {
                        success: true,
                        message: options.message || 'Data retrieved successfully',
                        data: transformedData.data,
                        pagination: transformedData.pagination,
                        timestamp: new Date().toISOString(),
                    } as StandardResponseData;
                }

                if (isPaginatedData(transformedData)) {
                    return {
                        success: true,
                        message: options.message || 'Data retrieved successfully',
                        data: transformedData.data,
                        pagination: transformedData.pagination,
                        timestamp: new Date().toISOString(),
                    } as StandardResponseData;
                }

                if (Array.isArray(transformedData)) {
                    return {
                        success: true,
                        message: options.message || 'Data retrieved successfully',
                        data: transformedData,
                        timestamp: new Date().toISOString(),
                    } as StandardResponseData;
                }

                return {
                    success: true,
                    message: options.message || 'Data retrieved successfully',
                    data: transformedData,
                    timestamp: new Date().toISOString(),
                } as StandardResponseData;
            }),
        );
    }
}
