export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    count: number;
    limit: number;
    offset: number;
    totalPages: number;
    currentPage: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface QueryOptions {
  where?: Record<string, any>;
  orderBy?: Record<string, "asc" | "desc"> | Record<string, "asc" | "desc">[];
  include?: Record<string, any>;
  select?: Record<string, any>;
  allowedSortFields?: string[];
  allowedFilterFields?: string[];
}

export type FilterValue = string | number | boolean;
export type FilterArrayValue = (string | number)[];
