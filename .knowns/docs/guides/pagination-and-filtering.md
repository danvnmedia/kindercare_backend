---
title: Pagination and Filtering
description: Backend API reference for pagination, sorting, and filtering
createdAt: '2026-01-03T19:51:53.795Z'
updatedAt: '2026-04-22T03:16:01.609Z'
tags:
  - guides
  - api
  - pagination
---

# Backend Pagination & Filtering API Reference

## Query Parameters

| Parameter | Type        | Default | Max | Description                          |
|-----------|-------------|---------|-----|--------------------------------------|
| limit   | number      | 10      | 50  | Number of items per page             |
| offset  | number      | 0       | -   | Number of items to skip              |
| sort    | string      | -       | -   | Comma-separated fields, - for desc |
| filter  | JSON string | -       | -   | Filter conditions as JSON            |

---

## Pagination (Offset-Based)

Formula: offset = (pageNumber - 1) * limit

Examples:
- Page 1: ?limit=10&offset=0
- Page 2: ?limit=10&offset=10
- Page 3: ?limit=10&offset=20
- Page 5 with 20 items per page: ?limit=20&offset=80

---

## Sorting

- Ascending: ?sort=fieldName
- Descending: ?sort=-fieldName (prefix with -)
- Multiple fields: ?sort=-createdAt,fullName (first by createdAt desc, then fullName asc)

---

## Filter Operators

| Operator  | Description               | Example                                    |
|-----------|---------------------------|--------------------------------------------|
| (none)    | Equals (simple)           | {"status": "active"}                     |
| eq      | Equals                    | {"status": {"eq": "active"}}             |
| ne      | Not equals                | {"status": {"ne": "archived"}}           |
| gt      | Greater than              | {"age": {"gt": 18}}                      |
| gte     | Greater than or equal     | {"age": {"gte": 18}}                     |
| lt      | Less than                 | {"price": {"lt": 100}}                   |
| lte     | Less than or equal        | {"price": {"lte": 100}}                  |
| like    | Contains (case-sensitive) | {"name": {"like": "john"}}               |
| ilike   | Contains (case-insensitive)| {"email": {"ilike": "gmail"}}           |
| in      | In array                  | {"status": {"in": ["active", "pending"]}} |
| not_in  | Not in array              | {"role": {"not_in": ["guest", "banned"]}} |
| between | Range (inclusive)         | {"age": {"between": [18, 65]}}           |



---

## Date Filtering

**Important:** Date fields must use **ISO 8601 format**: YYYY-MM-DDTHH:mm:ss.sssZ

### Supported Operators for Dates

| Operator  | Use Case                  | Example                                    |
|-----------|---------------------------|--------------------------------------------|
| (none)    | Exact date                | {"dateOfBirth": "2020-01-15T00:00:00.000Z"} |
| eq      | Exact date                | {"dateOfBirth": {"eq": "2020-01-15T00:00:00.000Z"}} |
| between | Date range (inclusive)    | {"dateOfBirth": {"between": ["2020-01-01T00:00:00.000Z", "2020-12-31T23:59:59.999Z"]}} |

### Date Filter Examples

**Students born on specific date:**
GET /students?filter={"dateOfBirth":"2020-01-15T00:00:00.000Z"}

**Students born in 2020:**
GET /students?filter={"dateOfBirth":{"between":["2020-01-01T00:00:00.000Z","2020-12-31T23:59:59.999Z"]}}

---

## Timezone Handling

### The Standard: Store UTC, Display Local

Frontend (any timezone) -> API (UTC) -> Database (UTC) -> API (UTC) -> Frontend (convert to local)

### Summary

| Field Type | Frontend Sends | Database Stores | Frontend Displays |
|------------|----------------|-----------------|-------------------|
| Date-only (DOB) | 2020-05-15T00:00:00.000Z | 2020-05-15 (DATE) | Convert to local format |
| Timestamp | 2025-12-16T03:30:00.000Z | 2025-12-16 03:30:00+00 (TIMESTAMPTZ) | Convert to local time |



---

## Response Format

Standard paginated response structure:
- success: boolean
- message: string
- data: array of items
- pagination: { count, limit, offset, totalPages, currentPage, hasNext, hasPrev }
- timestamp: ISO date string

### Pagination Object Fields

| Field         | Type    | Description                      |
|---------------|---------|----------------------------------|
| count       | number  | Total matching items             |
| limit       | number  | Items per page                   |
| offset      | number  | Items skipped                    |
| totalPages  | number  | Total pages available            |
| currentPage | number  | Current page (1-based)           |
| hasNext     | boolean | More pages after current         |
| hasPrev     | boolean | Pages before current             |

---

## Allowed Fields by Endpoint

### GET /students
- **Filterable**: studentCode, fullName, email, phoneNumber, gender, nickname, isArchived, dateOfBirth
- **Sortable**: createdAt, updatedAt, nickname, studentCode, fullName, dateOfBirth

### GET /staff
- **Filterable**: staffCode, fullName, email, phoneNumber, campusId, staffTypeId, gender, isArchived
- **Sortable**: createdAt, updatedAt, staffCode, fullName, email, startDate

### GET /guardians
- **Filterable**: fullName, email, phoneNumber, gender, occupation, workAddress, isArchived
- **Sortable**: createdAt, updatedAt, fullName, occupation

---

## Frontend Implementation Notes

1. **Limit is capped at 50** - requests for more will be reduced to 50
2. **Filter must be valid JSON** - use JSON.stringify() before adding to query
3. **Sort fields must be in allowed list** - check endpoint docs
4. **Filter fields must be in allowed list** - check endpoint docs
5. **Offset is 0-based** - first page starts at offset 0
6. **CurrentPage in response is 1-based** - first page is page 1
