import { Injectable } from "@nestjs/common";
import { StandardRequest } from "../dto/standard-request.dto";
import { FilterConditionDto } from "../dto/filter-schema.dto";
import {
  FilterValue,
  FilterArrayValue,
  QueryOptions,
  PaginatedResult,
} from "../dto/query.dto";

@Injectable()
export class PrismaQueryService {
  buildWhereClause(
    params: StandardRequest,
    allowedFields: string[] = [],
  ): Record<string, any> {
    const where: Record<string, any> = {};
    const filterData = params.filterInfo?.filters;

    if (
      filterData &&
      Object.keys(filterData).length > 0 &&
      allowedFields.length > 0
    ) {
      Object.entries(filterData).forEach(([field, conditions]) => {
        if (!allowedFields.includes(field)) return;

        if (this.isFilterValue(conditions)) {
          where[field] = conditions;
        } else if (this.isFilterConditionDto(conditions)) {
          where[field] = this.buildFieldConditions(conditions);
        }
      });
    }

    return where;
  }

  buildOrderByClause(
    params: StandardRequest,
    allowedFields: string[] = [],
  ):
    | Record<string, "asc" | "desc">
    | Record<string, "asc" | "desc">[]
    | undefined {
    const orderBy: Record<string, "asc" | "desc">[] = [];

    if (
      params.sortInfo?.sorts &&
      Array.isArray(params.sortInfo.sorts) &&
      params.sortInfo.sorts.length > 0 &&
      allowedFields.length > 0
    ) {
      params.sortInfo.sorts.forEach((sortItem) => {
        Object.entries(sortItem).forEach(([field, order]) => {
          if (allowedFields.includes(field)) {
            orderBy.push({ [field]: order as "asc" | "desc" });
          }
        });
      });
    }

    if (orderBy.length === 0) return undefined;
    return orderBy.length === 1 ? orderBy[0] : orderBy;
  }

  buildPaginationParams(params: StandardRequest): {
    take: number;
    skip: number;
  } {
    const limit = Math.min(
      Number(params.limit) || params.defaultLimit || 10,
      params.maxLimit || 50,
    );
    const offset = Number(params.offset) || 0;

    return {
      take: limit,
      skip: offset,
    };
  }

  private isFilterValue(value: unknown): value is FilterValue {
    return (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    );
  }

  private isFilterArrayValue(value: unknown): value is FilterArrayValue {
    return (
      Array.isArray(value) &&
      value.every(
        (item) =>
          typeof item === "string" ||
          typeof item === "number" ||
          typeof item === "boolean",
      )
    );
  }

  private isFilterConditionDto(value: unknown): value is FilterConditionDto {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  private buildFieldConditions(
    conditions: FilterConditionDto,
  ): Record<string, any> {
    const fieldConditions: Record<string, any> = {};

    Object.entries(conditions).forEach(([operator, value]) => {
      if (value === undefined || value === null) return;

      switch (operator) {
        case "eq":
          if (this.isFilterValue(value)) {
            fieldConditions.equals = value;
          }
          break;
        case "ne":
          if (this.isFilterValue(value)) {
            fieldConditions.not = value;
          }
          break;
        case "gt":
          if (typeof value === "number") {
            fieldConditions.gt = value;
          }
          break;
        case "gte":
          if (typeof value === "number" || value instanceof Date) {
            fieldConditions.gte = value;
          }
          break;
        case "lt":
          if (typeof value === "number") {
            fieldConditions.lt = value;
          }
          break;
        case "lte":
          if (typeof value === "number") {
            fieldConditions.lte = value;
          }
          break;
        case "like":
          if (typeof value === "string") {
            fieldConditions.contains = value;
          }
          break;
        case "ilike":
          if (typeof value === "string") {
            fieldConditions.mode = "insensitive";
            fieldConditions.contains = value;
          }
          break;
        case "in":
          if (this.isFilterArrayValue(value) && value.length > 0) {
            fieldConditions.in = value;
          }
          break;
        case "not_in":
          if (this.isFilterArrayValue(value) && value.length > 0) {
            fieldConditions.notIn = value;
          }
          break;
        case "between":
          if (
            Array.isArray(value) &&
            value.length === 2 &&
            this.isFilterValue(value[0]) &&
            this.isFilterValue(value[1])
          ) {
            fieldConditions.gte = value[0];
            fieldConditions.lte = value[1];
          }
          break;
      }
    });

    return fieldConditions;
  }

  async executeQuery<T>(
    prismaClient: any,
    modelName: string,
    params: StandardRequest,
    options: QueryOptions = {},
    MapperClass: { toDomain: (item: any) => T } | null = null,
  ): Promise<PaginatedResult<T>> {
    if (!params) {
      throw new Error("Query parameter is required");
    }

    const allowedSortFields =
      options.allowedSortFields || params.allowedSortFields || [];
    const allowedFilterFields =
      options.allowedFilterFields || params.allowedFilterFields || [];

    // Parse filter string to filterInfo if not already parsed
    if (
      !params.filterInfo ||
      Object.keys(params.filterInfo.filters || {}).length === 0
    ) {
      if (params.filter && typeof params.filter === "string") {
        try {
          const parsedFilter = JSON.parse(params.filter);
          params.filterInfo = { filters: parsedFilter };
        } catch {
          params.filterInfo = { filters: {} };
        }
      } else {
        params.filterInfo = { filters: {} };
      }
    }

    // Parse sort string to sortInfo if not already parsed
    if (!params.sortInfo || (params.sortInfo.sorts || []).length === 0) {
      if (params.sort && typeof params.sort === "string") {
        params.sortInfo = {
          sorts: params.sort.split(",").map((item) => {
            const trimmed = item.trim();
            const isDesc = trimmed.startsWith("-");
            const field = isDesc ? trimmed.substring(1) : trimmed;
            return { [field]: isDesc ? "desc" : "asc" };
          }),
        };
      } else {
        params.sortInfo = { sorts: [] };
      }
    }

    const where = {
      ...options.where,
      ...this.buildWhereClause(params, allowedFilterFields),
      ...options.scope, // Scope applied LAST - always wins, cannot be overridden by user
    };

    const orderBy = this.buildOrderByClause(params, allowedSortFields);
    const { take, skip } = this.buildPaginationParams(params);

    const queryOptions = {
      where,
      orderBy: orderBy || options.orderBy,
      include: options.include,
      select: options.select,
      take,
      skip,
    };

    let [data, count] = await Promise.all([
      prismaClient[modelName].findMany(queryOptions),
      prismaClient[modelName].count({ where }),
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

    if (MapperClass) {
      data = data.map((item) => MapperClass.toDomain(item));
    }

    return { data, pagination };
  }
}
