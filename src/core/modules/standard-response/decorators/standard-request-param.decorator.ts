import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { Request } from "express";
import { StandardRequest } from "../dto/standard-request.dto";
import { QueryValidatorService } from "../services/query-validator.service";

// Singleton instance of validator to avoid creating a new one on each request
const queryValidator = new QueryValidatorService();

export const StandardRequestParam = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const query = request.query;

    // Convert query parameters to appropriate types
    const parsedQuery: Record<string, unknown> = {};
    if (query.limit) parsedQuery.limit = Number(query.limit);
    if (query.offset) parsedQuery.offset = Number(query.offset);
    if (query.sort) parsedQuery.sort = query.sort;
    if (query.filter) parsedQuery.filter = query.filter;

    // Validate query parameters
    queryValidator.validateQuery(parsedQuery, {
      allowedSortFields: data && Array.isArray(data) ? data : undefined,
      maxLimit: 50,
      defaultLimit: 10,
    });

    // Return sanitized StandardRequest
    return queryValidator.sanitizeQuery(parsedQuery, {
      maxLimit: 50,
      defaultLimit: 10,
    });
  },
);
