import { ApiProperty } from '@nestjs/swagger';

export class FilterConditionDto {
    @ApiProperty({ description: 'Equal to', example: 'admin', required: false })
    eq?: string | number | boolean;

    @ApiProperty({
        description: 'Not equal to',
        example: 'user',
        required: false,
    })
    ne?: string | number | boolean;

    @ApiProperty({ description: 'Greater than', example: 100, required: false })
    gt?: number;

    @ApiProperty({
        description: 'Greater than or equal to',
        example: 100,
        required: false,
    })
    gte?: number | Date;

    @ApiProperty({ description: 'Less than', example: 1000, required: false })
    lt?: number;

    @ApiProperty({
        description: 'Less than or equal to',
        example: 1000,
        required: false,
    })
    lte?: number;

    @ApiProperty({
        description: 'Contains (case sensitive)',
        example: 'search',
        required: false,
    })
    like?: string;

    @ApiProperty({
        description: 'Contains (case insensitive)',
        example: 'search',
        required: false,
    })
    ilike?: string;

    @ApiProperty({
        description: 'In array',
        example: ['Apple', 'Samsung'],
        required: false,
    })
    in?: (string | number)[];

    @ApiProperty({
        description: 'Not in array',
        example: ['Apple', 'Samsung'],
        required: false,
    })
    not_in?: (string | number)[];

    @ApiProperty({
        description: 'Between range',
        example: ['2024-01-01', '2024-12-31'],
        required: false,
    })
    between?: [string | number, string | number];
}

export class FilterSchemaDto {
    @ApiProperty({
        description: 'Filter conditions for each field',
        example: {
            role: 'admin',
            price: { gte: 15000000, lte: 30000000 },
            brand: { in: ['Apple', 'Samsung'] },
            rating: { gte: 4.5 },
            created_at: { between: ['2025-01-01T00:00:00Z', '2025-01-31T23:59:59Z'] },
        },
    })
    filters?: Record<string, string | number | boolean | FilterConditionDto>;
}

export class SortSchemaDto {
    @ApiProperty({
        description: 'Sort fields array with field and order',
        example: [{ name: 'asc' }, { created_at: 'desc' }],
        required: false,
    })
    sorts?: Record<string, 'asc' | 'desc'>[];
}
