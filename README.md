# NestJS Clean Architecture Boilerplate

A production-ready NestJS boilerplate following Clean Architecture principles with advanced standard response formatting, filtering, sorting, pagination, queue processing, and cron jobs.

**Author**: [@howznguyen](https://github.com/howznguyen)  
**Repository**: [GitHub](https://github.com/howznguyen/nestjs-clean-architecture-boilerplate)

## Features

- ✅ **Clean Architecture**: Domain-driven design with clear separation of concerns
- ✅ **Advanced Standard Response**: Consistent API response format with filtering, sorting & pagination
- ✅ **Mapper Pattern**: Clean separation between domain and persistence layers
- ✅ **Queue Processing**: Bull/BullMQ integration with Redis for background jobs
- ✅ **Cron Jobs**: Scheduled tasks using `@nestjs/schedule`
- ✅ **Database**: PostgreSQL with Prisma ORM and relationship handling
- ✅ **Docker**: Full containerization with environment variables
- ✅ **API Documentation**: Auto-generated OpenAPI/Swagger with query examples
- ✅ **Validation**: Request/response validation with class-validator
- ✅ **TypeScript**: Full TypeScript support
- ✅ **Testing**: Jest testing framework setup

## Architecture

```
src/
├── core/                           # Core utilities and shared modules
│   ├── entities/                   # Base entities and value objects
│   └── modules/                    
│       └── standard-response/      # Standard response formatting
├── domain/                         # Business logic layer
│   └── user-management/            # User domain entities
├── application/                    # Use cases layer
│   └── user-management/            # User use cases and ports
└── infra/                          # Infrastructure layer
    ├── http/                       # HTTP controllers and DTOs
    ├── persistence/                # Database repositories
    ├── queue/                      # Background job processing
    └── cronjob/                    # Scheduled tasks
```

## Quick Start

### Prerequisites

- Node.js 18+ 
- Docker & Docker Compose
- PostgreSQL (if running locally)
- Redis (if running locally)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd nestjs-boilerplate
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
   # Development mode
   docker-compose up app-dev
   
   # Production mode
   docker-compose up app
   ```

5. **Or start locally**
   ```bash
   # Generate Prisma client
   npm run prisma:generate
   
   # Run migrations
   npm run prisma:migrate:dev
   
   # Start development server
   npm run start:dev
   ```

## API Documentation

Once the application is running, visit:
- **Swagger UI**: http://localhost:3000/api/docs

## Standard Response Format

All API responses follow a consistent format:

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": { ... },
  "pagination": { ... }, // Only for paginated responses
  "timestamp": "2023-01-01T00:00:00.000Z"
}
```

### Using Standard Response Decorator

```typescript
@Controller('users')
export class UserController {
  @Get()
  @StandardResponse({
    message: 'Users retrieved successfully',
    type: UserResponseDto,
  })
  async getUsers() {
    return await this.userService.findAll();
  }
}
```

## Queue Processing

The boilerplate includes Bull/BullMQ for background job processing:

```typescript
// Adding jobs to queue
await this.queueService.addEmailJob({
  to: 'user@example.com',
  subject: 'Welcome!',
  text: 'Welcome to our platform'
});
```

## Cron Jobs

Schedule tasks using decorators:

```typescript
@Injectable()
export class TasksService {
  @Cron(CronExpression.EVERY_HOUR)
  handleHourlyTask() {
    // Task logic here
  }
}
```

## Database Operations

### Using Repositories

```typescript
@Injectable()
export class CreateUserUseCase {
  constructor(private userRepository: UserRepository) {}

  async execute(dto: CreateUserDto): Promise<User> {
    const user = User.create(dto);
    await this.userRepository.save(user);
    return user;
  }
}
```

### Prisma Migrations

```bash
# Create migration
npm run prisma:migrate:dev --name add_users_table

# Deploy migrations
npm run prisma:migrate:deploy

# Reset database
npm run prisma:migrate:reset
```

## Testing

```bash
# Unit tests
npm run test

# Integration tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## Docker Commands

### Development
```bash
# Start development environment
docker-compose up app-dev

# View logs
docker-compose logs -f app-dev

# Execute commands in container
docker-compose exec app-dev npm run prisma:migrate:dev
```

### Production
```bash
# Build and start production
docker-compose up --build app

# Scale services
docker-compose up --scale app=3
```

## Available Scripts

- `npm run start` - Start production server
- `npm run start:dev` - Start development server with hot reload
- `npm run start:debug` - Start with debugging enabled
- `npm run build` - Build for production
- `npm run lint` - Lint code
- `npm run test` - Run unit tests
- `npm run test:e2e` - Run integration tests

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Application port | `3000` |
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `REDIS_HOST` | Redis host | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |
| `CORS_ORIGIN` | CORS origin | `true` |

## Project Structure Details

### Core Layer
- **Entities**: Base classes for domain entities
- **Standard Response**: Automatic response formatting and validation

### Domain Layer
- **Entities**: Business entities with domain logic
- **Value Objects**: Immutable objects representing domain concepts

### Application Layer
- **Use Cases**: Application business logic
- **Ports**: Interfaces for external dependencies

### Infrastructure Layer
- **HTTP**: REST API controllers and DTOs
- **Persistence**: Database implementations
- **Queue**: Background job processing
- **Cronjob**: Scheduled task implementations

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the UNLICENSED License.