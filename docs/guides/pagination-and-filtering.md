# Backend Pagination & Filtering API Reference

## Query Parameters

| Parameter | Type        | Default | Max | Description                          |
|-----------|-------------|---------|-----|--------------------------------------|
| `limit`   | number      | 10      | 50  | Number of items per page             |
| `offset`  | number      | 0       | -   | Number of items to skip              |
| `sort`    | string      | -       | -   | Comma-separated fields, `-` for desc |
| `filter`  | JSON string | -       | -   | Filter conditions as JSON            |

---

## Pagination (Offset-Based)

Formula: `offset = (pageNumber - 1) * limit`

Examples:
- Page 1: `?limit=10&offset=0`
- Page 2: `?limit=10&offset=10`
- Page 3: `?limit=10&offset=20`
- Page 5 with 20 items per page: `?limit=20&offset=80`

---

## Sorting

- Ascending: `?sort=fieldName`
- Descending: `?sort=-fieldName` (prefix with `-`)
- Multiple fields: `?sort=-createdAt,fullName` (first by createdAt desc, then fullName asc)

---

## Filter Operators

| Operator  | Description               | Example                                    |
|-----------|---------------------------|--------------------------------------------|
| (none)    | Equals (simple)           | `{"status": "active"}`                     |
| `eq`      | Equals                    | `{"status": {"eq": "active"}}`             |
| `ne`      | Not equals                | `{"status": {"ne": "archived"}}`           |
| `gt`      | Greater than              | `{"age": {"gt": 18}}`                      |
| `gte`     | Greater than or equal     | `{"age": {"gte": 18}}`                     |
| `lt`      | Less than                 | `{"price": {"lt": 100}}`                   |
| `lte`     | Less than or equal        | `{"price": {"lte": 100}}`                  |
| `like`    | Contains (case-sensitive) | `{"name": {"like": "john"}}`               |
| `ilike`   | Contains (case-insensitive)| `{"email": {"ilike": "gmail"}}`           |
| `in`      | In array                  | `{"status": {"in": ["active", "pending"]}}` |
| `not_in`  | Not in array              | `{"role": {"not_in": ["guest", "banned"]}}` |
| `between` | Range (inclusive)         | `{"age": {"between": [18, 65]}}`           |

Combined example:
```json
{"fullName": {"ilike": "john"}, "age": {"gte": 18, "lte": 65}, "status": "active"}
```

---

## Response Format

```json
{
  "success": true,
  "message": "Resources retrieved successfully",
  "data": [
    { "id": 1, "fullName": "John Doe" },
    { "id": 2, "fullName": "Jane Doe" }
  ],
  "pagination": {
    "count": 150,
    "limit": 10,
    "offset": 0,
    "totalPages": 15,
    "currentPage": 1,
    "hasNext": true,
    "hasPrev": false
  },
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

### Pagination Object Fields

| Field         | Type    | Description                      |
|---------------|---------|----------------------------------|
| `count`       | number  | Total matching items             |
| `limit`       | number  | Items per page                   |
| `offset`      | number  | Items skipped                    |
| `totalPages`  | number  | Total pages available            |
| `currentPage` | number  | Current page (1-based)           |
| `hasNext`     | boolean | More pages after current         |
| `hasPrev`     | boolean | Pages before current             |

---

## Allowed Fields by Endpoint

### GET /students
- **Filterable**: `studentCode`, `fullName`, `email`, `phoneNumber`, `gender`, `nickname`, `isArchived`
- **Sortable**: `createdAt`, `updatedAt`, `nickname`, `studentCode`, `fullName`

### GET /guardians
- **Filterable**: `fullName`, `email`, `phoneNumber`, `gender`, `occupation`, `workAddress`, `isArchived`
- **Sortable**: `createdAt`, `updatedAt`, `fullName`, `occupation`

---

## Full Request Examples

### Basic pagination
```
GET /students?limit=10&offset=0
```

### With sorting
```
GET /students?limit=10&offset=0&sort=-createdAt
```

### With filtering
```
GET /students?limit=10&offset=0&filter={"isArchived":false}
```

### Complete example
```
GET /students?limit=20&offset=40&sort=-createdAt,fullName&filter={"fullName":{"ilike":"john"},"gender":"Male","isArchived":false}
```

### URL-encoded version of above
```
GET /students?limit=20&offset=40&sort=-createdAt,fullName&filter=%7B%22fullName%22%3A%7B%22ilike%22%3A%22john%22%7D%2C%22gender%22%3A%22Male%22%2C%22isArchived%22%3Afalse%7D
```

---

## Error Responses

### Invalid filter JSON (400)
```json
{
  "statusCode": 400,
  "message": "Invalid filter JSON format",
  "error": "Bad Request"
}
```

### Invalid sort field (400)
```json
{
  "statusCode": 400,
  "message": "Sort field 'invalidField' is not allowed. Allowed fields: createdAt, updatedAt, fullName",
  "error": "Bad Request"
}
```

### Invalid filter field (400)
```json
{
  "statusCode": 400,
  "message": "Filter field 'badField' is not allowed. Allowed fields: fullName, email, ...",
  "error": "Bad Request"
}
```

---

## Frontend Implementation Notes

1. **Limit is capped at 50** - requests for more will be reduced to 50
2. **Filter must be valid JSON** - use `JSON.stringify()` before adding to query
3. **Sort fields must be in allowed list** - check endpoint docs
4. **Filter fields must be in allowed list** - check endpoint docs
5. **Offset is 0-based** - first page starts at offset 0
6. **CurrentPage in response is 1-based** - first page is page 1
