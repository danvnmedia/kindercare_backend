import { ApiProperty } from '@nestjs/swagger';

export class EmptyResponseDto { }

export class StandardPaginationDto {
    @ApiProperty({
        description: 'Total count of items',
        example: 25,
    })
    count: number;

    @ApiProperty({
        description: 'Items per page',
        example: 10,
    })
    limit: number;

    @ApiProperty({
        description: 'Number of items to skip',
        example: 0,
    })
    offset: number;

    @ApiProperty({
        description: 'Total number of pages',
        example: 3,
    })
    totalPages: number;

    @ApiProperty({
        description: 'Current page number',
        example: 1,
    })
    currentPage: number;

    @ApiProperty({
        description: 'Has next page',
        example: true,
    })
    hasNext: boolean;

    @ApiProperty({
        description: 'Has previous page',
        example: false,
    })
    hasPrev: boolean;
}

export class StandardResponseWithoutPaginationDto<T = unknown> {
    @ApiProperty({
        description: 'Request success status',
        example: true,
    })
    success: boolean;

    @ApiProperty({
        description: 'Response message',
        example: 'Operation completed successfully',
    })
    message: string;

    @ApiProperty({
        description: 'Response data',
    })
    data: T;

    @ApiProperty({
        description: 'Response timestamp',
        example: '2024-01-01T00:00:00.000Z',
    })
    timestamp: string;
}

export class StandardResponseDto<
    T = unknown,
> extends StandardResponseWithoutPaginationDto<T> {
    @ApiProperty({
        description: 'Pagination information',
        required: false,
    })
    pagination?: StandardPaginationDto;
}

type ConstructorFunction = new (...args: unknown[]) => unknown;

function isConstructorFunction(value: unknown): value is ConstructorFunction {
    return typeof value === 'function' && value.prototype !== undefined;
}

function hasName(value: unknown): value is { name: string } {
    return (
        typeof value === 'object' &&
        value !== null &&
        'name' in value &&
        typeof (value as { name: unknown }).name === 'string'
    );
}

export function createStandardResponseClass<T>(
    dataType: ConstructorFunction | string | null | undefined,
    isPaginated: boolean = false,
    isArray: boolean = false,
): ConstructorFunction {
    let typeName = `StandardResponseWith`;

    if (dataType === null || dataType === undefined) {
        typeName += 'Empty';
        dataType = EmptyResponseDto;
    } else if (isConstructorFunction(dataType) && hasName(dataType)) {
        typeName += dataType.name;
    } else if (typeof dataType === 'string') {
        typeName += dataType;
    } else {
        typeName += 'Unknown' + Math.random().toString(36).substring(2, 15);
    }

    const className = `${typeName}${isPaginated ? 'Array' : ''}`;

    class DynamicClassWithPagination extends StandardResponseDto<T> {
        @ApiProperty({
            description: 'Response data',
            type: isPaginated
                ? [dataType as ConstructorFunction]
                : (dataType as ConstructorFunction),
        })
        declare data: T;
    }

    class DynamicClassWithoutPagination extends StandardResponseWithoutPaginationDto<T> {
        @ApiProperty({
            description: 'Response data',
            type: isArray
                ? [dataType as ConstructorFunction]
                : (dataType as ConstructorFunction),
        })
        declare data: T;
    }

    const SelectedClass = isPaginated
        ? DynamicClassWithPagination
        : DynamicClassWithoutPagination;

    Object.defineProperty(SelectedClass, 'name', {
        value: className,
    });

    return SelectedClass as ConstructorFunction;
}
