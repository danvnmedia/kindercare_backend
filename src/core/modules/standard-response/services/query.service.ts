import { Injectable } from '@nestjs/common';
import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { StandardRequest } from '../dto/standard-request.dto';
import { FilterConditionDto } from '../dto/filter-schema.dto';
import { FilterValue, FilterArrayValue, QueryOptions, PaginatedResult } from '../dto/query.dto';

@Injectable()
export class QueryService {
    applyPagination<T extends ObjectLiteral>(
        queryBuilder: SelectQueryBuilder<T>,
        params: StandardRequest,
    ): void {
        const limit = Math.min(
            Number(params.limit) || params.defaultLimit || 10,
            params.maxLimit || 50,
        );
        const offset = Number(params.offset) || 0;
        queryBuilder.take(limit).skip(offset);
    }

    applySorting<T extends ObjectLiteral>(
        queryBuilder: SelectQueryBuilder<T>,
        params: StandardRequest,
        alias: string,
        allowedFields: string[] = [],
    ): void {
        if (
            params.sortInfo?.sorts &&
            Array.isArray(params.sortInfo.sorts) &&
            params.sortInfo.sorts.length > 0 &&
            allowedFields.length > 0
        ) {
            let isFirstSort = true;
            params.sortInfo.sorts.forEach((sortItem) => {
                Object.entries(sortItem).forEach(([field, order]) => {
                    if (allowedFields.includes(field)) {
                        const orderDirection = String(order).toUpperCase() as
                            | 'ASC'
                            | 'DESC';
                        if (isFirstSort) {
                            queryBuilder.orderBy(`${alias}.${field}`, orderDirection);
                            isFirstSort = false;
                        } else {
                            queryBuilder.addOrderBy(`${alias}.${field}`, orderDirection);
                        }
                    }
                });
            });
        }
    }

    private isFilterValue(value: unknown): value is FilterValue {
        return (
            typeof value === 'string' ||
            typeof value === 'number' ||
            typeof value === 'boolean'
        );
    }

    private isFilterArrayValue(value: unknown): value is FilterArrayValue {
        return (
            Array.isArray(value) &&
            value.every(
                (item) =>
                    typeof item === 'string' ||
                    typeof item === 'number' ||
                    typeof item === 'boolean',
            )
        );
    }

    private isFilterConditionDto(value: unknown): value is FilterConditionDto {
        return typeof value === 'object' && value !== null && !Array.isArray(value);
    }

    applyFiltering<T extends ObjectLiteral>(
        queryBuilder: SelectQueryBuilder<T>,
        params: StandardRequest,
        alias: string,
        allowedFields: string[] = [],
    ): void {
        const filterData = params.filterInfo?.filters;

        if (
            filterData &&
            Object.keys(filterData).length > 0 &&
            allowedFields.length > 0
        ) {
            Object.entries(filterData).forEach(([field, conditions]) => {
                if (!allowedFields.includes(field)) return;

                if (this.isFilterValue(conditions)) {
                    const parameterName = `${field}_eq`;
                    queryBuilder.andWhere(`${alias}.${field} = :${parameterName}`, {
                        [parameterName]: conditions,
                    });
                } else if (this.isFilterConditionDto(conditions)) {
                    Object.entries(conditions).forEach(([operator, value]) => {
                        if (value === undefined || value === null) return;

                        const parameterName = `${field}_${operator}`;

                        switch (operator) {
                            case 'eq':
                                if (this.isFilterValue(value)) {
                                    queryBuilder.andWhere(
                                        `${alias}.${field} = :${parameterName}`,
                                        {
                                            [parameterName]: value,
                                        },
                                    );
                                }
                                break;
                            case 'ne':
                                if (this.isFilterValue(value)) {
                                    queryBuilder.andWhere(
                                        `${alias}.${field} != :${parameterName}`,
                                        { [parameterName]: value },
                                    );
                                }
                                break;
                            case 'gt':
                                if (typeof value === 'number') {
                                    queryBuilder.andWhere(
                                        `${alias}.${field} > :${parameterName}`,
                                        {
                                            [parameterName]: value,
                                        },
                                    );
                                }
                                break;
                            case 'gte':
                                if (typeof value === 'number' || value instanceof Date) {
                                    queryBuilder.andWhere(
                                        `${alias}.${field} >= :${parameterName}`,
                                        { [parameterName]: value },
                                    );
                                }
                                break;
                            case 'lt':
                                if (typeof value === 'number') {
                                    queryBuilder.andWhere(
                                        `${alias}.${field} < :${parameterName}`,
                                        {
                                            [parameterName]: value,
                                        },
                                    );
                                }
                                break;
                            case 'lte':
                                if (typeof value === 'number') {
                                    queryBuilder.andWhere(
                                        `${alias}.${field} <= :${parameterName}`,
                                        { [parameterName]: value },
                                    );
                                }
                                break;
                            case 'like':
                                if (typeof value === 'string') {
                                    queryBuilder.andWhere(
                                        `${alias}.${field} LIKE :${parameterName}`,
                                        { [parameterName]: `%${value}%` },
                                    );
                                }
                                break;
                            case 'ilike':
                                if (typeof value === 'string') {
                                    queryBuilder.andWhere(
                                        `${alias}.${field} ILIKE :${parameterName}`,
                                        { [parameterName]: `%${value}%` },
                                    );
                                }
                                break;
                            case 'in':
                                if (this.isFilterArrayValue(value) && value.length > 0) {
                                    queryBuilder.andWhere(
                                        `${alias}.${field} IN (:...${parameterName})`,
                                        { [parameterName]: value },
                                    );
                                }
                                break;
                            case 'not_in':
                                if (this.isFilterArrayValue(value) && value.length > 0) {
                                    queryBuilder.andWhere(
                                        `${alias}.${field} NOT IN (:...${parameterName})`,
                                        { [parameterName]: value },
                                    );
                                }
                                break;
                            case 'between':
                                if (
                                    Array.isArray(value) &&
                                    value.length === 2 &&
                                    this.isFilterValue(value[0]) &&
                                    this.isFilterValue(value[1])
                                ) {
                                    queryBuilder.andWhere(
                                        `${alias}.${field} BETWEEN :${parameterName}_start AND :${parameterName}_end`,
                                        {
                                            [`${parameterName}_start`]: value[0],
                                            [`${parameterName}_end`]: value[1],
                                        },
                                    );
                                }
                                break;
                        }
                    });
                }
            });
        }
    }

    async executeQuery<T extends ObjectLiteral>(
        queryBuilder: SelectQueryBuilder<T>,
        params: StandardRequest,
        alias: string,
        options: QueryOptions = {},
    ): Promise<PaginatedResult<T>> {
        if (!params) {
            throw new Error('Query parameter is required');
        }

        const allowedSortFields = params.allowedSortFields || [];
        const allowedFilterFields = params.allowedFilterFields || [];

        if (!params.filterInfo) {
            params.filterInfo = { filters: {} };
        }
        if (!params.sortInfo) {
            params.sortInfo = { sorts: [] };
        }

        const countQueryBuilder = queryBuilder.clone();

        this.applySorting(queryBuilder, params, alias, allowedSortFields);
        this.applyFiltering(queryBuilder, params, alias, allowedFilterFields);
        this.applyPagination(queryBuilder, params);

        this.applyFiltering(countQueryBuilder, params, alias, allowedFilterFields);

        const [data, count] = await Promise.all([
            queryBuilder.getMany(),
            countQueryBuilder.getCount(),
        ]);

        const limit = Math.min(
            Number(params.limit) || params.defaultLimit || 10,
            params.maxLimit || 50,
        );
        const offset = Number(params.offset) || 0;
        const currentPage = Math.floor(offset / limit) + 1;
        const totalPages = Math.ceil(count / limit);

        const pagination = {
            count,
            limit,
            offset,
            totalPages,
            currentPage,
            hasNext: currentPage < totalPages,
            hasPrev: currentPage > 1,
        };

        return { data, pagination };
    }
}
