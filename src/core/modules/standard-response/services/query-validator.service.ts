import { Injectable, BadRequestException } from "@nestjs/common";
import { StandardRequest } from "../dto/standard-request.dto";
import { FilterConditionDto } from "../dto/filter-schema.dto";

interface ValidationOptions {
  allowedSortFields?: string[];
  allowedFilterFields?: string[];
  maxLimit?: number;
  defaultLimit?: number;
}

@Injectable()
export class QueryValidatorService {
  validateQuery(
    query: Record<string, unknown>,
    options: ValidationOptions,
  ): void {
    const sanitizedQuery = { ...query };

    let parsedFilter: Record<string, unknown> = {};
    if (sanitizedQuery.filter && typeof sanitizedQuery.filter === "string") {
      try {
        parsedFilter = JSON.parse(sanitizedQuery.filter) as Record<
          string,
          unknown
        >;
      } catch {
        throw new BadRequestException("Invalid filter JSON format");
      }
    }
    if (
      sanitizedQuery.sort &&
      typeof sanitizedQuery.sort === "string" &&
      options.allowedSortFields &&
      options.allowedSortFields.length > 0
    ) {
      const sortFields: string[] = sanitizedQuery.sort
        .split(",")
        .map((field) => field.trim());

      sortFields.forEach((field) => {
        const cleanField = field.startsWith("-") ? field.substring(1) : field;
        if (!options.allowedSortFields!.includes(cleanField)) {
          throw new BadRequestException(
            `Sort field '${cleanField}' is not allowed. Allowed fields: ${options.allowedSortFields!.join(", ")}`,
          );
        }
      });
    }

    if (
      Object.keys(parsedFilter).length > 0 &&
      options.allowedFilterFields &&
      options.allowedFilterFields.length > 0
    ) {
      const filterKeys = Object.keys(parsedFilter);

      filterKeys.forEach((field) => {
        if (!options.allowedFilterFields!.includes(field)) {
          throw new BadRequestException(
            `Filter field '${field}' is not allowed. Allowed fields: ${options.allowedFilterFields!.join(", ")}`,
          );
        }
      });
    }

    if (sanitizedQuery.limit && typeof sanitizedQuery.limit === "string") {
      const limit = parseInt(sanitizedQuery.limit);
      if (isNaN(limit) || limit < 1) {
        throw new BadRequestException("Limit must be a positive number");
      }
      if (options.maxLimit && limit > options.maxLimit) {
        throw new BadRequestException(
          `Limit cannot exceed ${options.maxLimit}`,
        );
      }
    }

    if (sanitizedQuery.offset && typeof sanitizedQuery.offset === "string") {
      const offset = parseInt(sanitizedQuery.offset);
      if (isNaN(offset) || offset < 0) {
        throw new BadRequestException("Offset must be a non-negative number");
      }
    }
  }

  sanitizeQuery(
    query: Record<string, unknown>,
    options: {
      defaultLimit?: number;
      maxLimit?: number;
    },
  ): StandardRequest {
    const sanitized: StandardRequest & { search?: string; q?: string } = {
      limit: typeof query.limit === "number" ? query.limit : undefined,
      offset: typeof query.offset === "number" ? query.offset : undefined,
      sort: typeof query.sort === "string" ? query.sort : undefined,
      search: typeof query.search === "string" ? query.search : undefined,
      q: typeof query.q === "string" ? query.q : undefined,
      filter: typeof query.filter === "string" ? query.filter : undefined,
      filterInfo: undefined,
      sortInfo: undefined,
      allowedSortFields: [],
      allowedFilterFields: [],
      defaultLimit: options.defaultLimit || 10,
      maxLimit: options.maxLimit || 50,
    };

    if (!sanitized.limit && options.defaultLimit) {
      sanitized.limit = options.defaultLimit;
    }

    if (sanitized.limit && options.maxLimit) {
      sanitized.limit = Math.min(sanitized.limit, options.maxLimit);
    }

    if (!sanitized.offset) {
      sanitized.offset = 0;
    }

    let parsedFilter: Record<
      string,
      string | number | boolean | FilterConditionDto
    > = {};
    if (sanitized.filter && typeof sanitized.filter === "string") {
      try {
        parsedFilter = JSON.parse(sanitized.filter) as Record<
          string,
          string | number | boolean | FilterConditionDto
        >;
      } catch {
        parsedFilter = {};
      }
    }

    sanitized.filterInfo = {
      filters: parsedFilter,
    };

    if (sanitized.sort) {
      sanitized.sortInfo = {
        sorts: sanitized.sort.split(",").map((item) => {
          const isDesc = item.startsWith("-");
          const field = isDesc ? item.substring(1) : item;
          return { [field]: isDesc ? "desc" : "asc" };
        }),
      };
    } else {
      sanitized.sortInfo = { sorts: [] };
    }

    return sanitized;
  }
}
