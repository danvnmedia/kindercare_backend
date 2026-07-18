# Kindercare Multi-Campus Backend

A production-ready NestJS backend for managing multiple school campuses with Clean Architecture principles, RBAC, content management, and comprehensive API features.

**Repository:** [danvnmedia/kindercare_backend](https://github.com/danvnmedia/kindercare_backend)

## Features

- **Multi-Campus Architecture**: Federated campus isolation with global user identity
- **Role-Based Access Control (RBAC)**: Granular permissions with campus-scoped roles
- **Clean Architecture**: Domain-driven design with clear separation of concerns
- **Content Management System**: Posts, categories, comments, reactions, and approval workflows
- **Advanced Standard Response**: Consistent API response format with filtering, sorting & pagination
- **Queue Processing**: Bull/BullMQ integration with Redis for background jobs
- **Database**: PostgreSQL with Prisma ORM and relationship handling
- **Docker**: Full containerization with environment variables
- **API Documentation**: Auto-generated OpenAPI/Swagger with campus context
- **Authentication**: Clerk integration for user identity management
- **TypeScript**: Full TypeScript support with strict typing

## Multi-Campus Architecture

The backend uses a **federated multi-campus architecture** that enables a single application instance to serve multiple school campuses while maintaining strict data isolation.

### Core Principle

**Global User Identity + Campus-Scoped Everything Else**

```
┌─────────────────────────────────────────┐
│            GLOBAL LAYER                  │
│  User (Clerk) │ Permission │ System Roles│
└─────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│            CAMPUS LAYER                  │
│  ┌─────────────────────────────────┐    │
│  │  Staff  │ Students │ Classes    │    │
│  │  Posts  │ Files    │ Attendance │    │
│  │  Grades │ Subjects │ SchoolYears│    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

### Campus Context

Most API endpoints require an `X-Campus-Id` header to scope requests:

```bash
curl -X GET "http://localhost:3000/api/students" \
  -H "Authorization: Bearer <jwt>" \
  -H "X-Campus-Id: <campus-uuid>"
```

### Entity Classification

| Type | Examples | campusId |
|------|----------|----------|
| Global | User, Permission | None |
| Campus-Scoped | Staff, Student, Class, Post | Required (immutable) |
| Hybrid | Role, UserRole | Optional (null = global) |

## Architecture

```
src/
├── core/                           # Core utilities and shared modules
│   ├── entities/                   # Base entities and value objects
│   └── modules/
│       └── standard-response/      # Standard response formatting
├── domain/                         # Business logic layer
│   ├── campus/                     # Campus domain
│   ├── user-management/            # Users, Staff, Students, Guardians
│   ├── class-management/           # Classes, Grades, Subjects
│   ├── content-management/         # Posts, Categories, Comments
│   ├── file-management/            # File uploads
│   ├── attendance/                 # Student attendance
│   └── rbac/                       # Permissions and roles
├── application/                    # Use cases layer
│   └── {module}/                   # Use cases and ports per domain
└── infra/                          # Infrastructure layer
    ├── http/                       # Controllers, Guards, DTOs
    ├── persistence/                # Prisma repositories and mappers
    ├── queue/                      # Background job processing
    └── cronjob/                    # Scheduled tasks
```

## Quick Start

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- PostgreSQL connection string (hosted or local)
- Redis (if running locally)

### Installation

1. **Clone the repository**
   ```bash
   git clone git@github.com:danvnmedia/kindercare_backend.git kindercare-backend
   cd kindercare-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Setup environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start with Docker (Recommended)**
   ```bash
   # Standard app + Redis stack (DATABASE_URL supplies PostgreSQL)
   docker compose up --build app

   # Development mode with source mounts
   docker compose -f docker-compose.dev.yml up --build app

   # Production-like mode
   docker compose -f docker-compose.prod.yml up -d --build
   ```

5. **Or start locally**
   ```bash
   # Generate Prisma client
   npm run prisma:generate

   # Run migrations
   npm run prisma:migrate:dev

   # Seed initial data
   npm run prisma:seed

   # Start development server
   npm run start:dev
   ```

## API Documentation

Once the application is running, visit:
- **Swagger UI**: http://localhost:3000/docs

### Authentication

All protected endpoints require a JWT token from Clerk:
- Header: `Authorization: Bearer <jwt>`

### Campus Context

Campus-scoped endpoints require:
- Header: `X-Campus-Id: <campus-uuid>`

The system validates:
1. Campus exists and is active
2. User has roles assigned in that campus
3. Global admins can access any campus

## RBAC (Role-Based Access Control)

### Permissions

Atomic, code-based identifiers: `{module}.{action}`
- Examples: `student.create`, `class.read`, `post.delete`

### Roles

| Type | campusId | Scope |
|------|----------|-------|
| System Default | null | All campuses |
| Campus-Specific | UUID | One campus only |

### User Role Assignments

Users can have different roles per campus:
```
User 'John'
├── Global: super_admin (applies everywhere)
├── Campus A: teacher
└── Campus B: principal
```

## Standard Response Format

All API responses follow a consistent format:

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": { ... },
  "pagination": { ... },
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

## Database Operations

### Prisma Migrations

```bash
# Create migration
npm run prisma:migrate:dev --name add_feature

# Deploy migrations
npm run prisma:migrate:deploy

# Reset database
npm run prisma:migrate:reset
```

### Database Diagram

See `diagram/dbdiagram.dbml` for the current schema in DBML format.

## Testing

```bash
# Unit tests
npm run test

# Integration tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Application port | `3000` |
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `REDIS_HOST` | Redis host | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |
| `CORS_ORIGIN` | CORS origin | `true` |
| `CLERK_SECRET_KEY` | Clerk authentication secret | Required |

## Available Scripts

- `npm run start` - Start production server
- `npm run start:dev` - Start development server with hot reload
- `npm run start:debug` - Start with debugging enabled
- `npm run build` - Build for production
- `npm run lint` - Lint code
- `npm run test` - Run unit tests
- `npm run test:e2e` - Run integration tests
- `npm run prisma:seed` - Seed database with initial data

## Documentation

See `.knowns/docs/` for detailed documentation:
- `architecture/` - System architecture docs
- `patterns/` - Code patterns and conventions
- `guides/` - Developer guides
- `migrations/` - Migration documentation

For GitHub Actions, production environment variables, database migrations, and
Vercel container deployment, see [`DEPLOYMENT.md`](DEPLOYMENT.md).

## Acknowledgements

This project is based on [NestJS Clean Architecture Boilerplate](https://github.com/howznguyen/nestjs-clean-architecture-boilerplate) by [@howznguyen](https://github.com/howznguyen). Original authorship is retained in the Git history.

## License

Copyright © DHA Enterprise. All rights reserved.

This is proprietary software and is not licensed for public use or redistribution. The npm package is marked `private` and `UNLICENSED`.
