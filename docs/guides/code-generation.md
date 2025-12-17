# Code Generation Pattern

> Sequential code generation using counter tables for entities like Student.

---

## Overview

Some entities require auto-generated codes that:
- Follow a specific format (e.g., `YYYY-XXXXXX`)
- Are unique and sequential
- Reset based on a time period (e.g., yearly)
- Handle concurrent requests safely

---

## Student Code Format

| Component | Description | Example |
|-----------|-------------|---------|
| `YYYY` | 4-digit year | `2025` |
| `-` | Separator | `-` |
| `XXXXXX` | 6-digit sequence, zero-padded | `000001` |

**Full example**: `2025-000001`, `2025-000002`, ... `2026-000001`

---

## Architecture

### Database Schema

Counter table tracks the last used number per year:

```prisma
model StudentCodeSequence {
  year       Int      @id
  lastNumber Int      @default(0) @map("last_number")
  updatedAt  DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)

  @@map("student_code_sequence")
}
```

### Service

Located in `src/infra/persistence/prisma/services/student-code-generator.service.ts`

```typescript
@Injectable()
export class StudentCodeGeneratorService {
  constructor(private readonly prisma: PrismaService) {}

  async generateNextCode(): Promise<string> {
    const currentYear = new Date().getFullYear();

    // Atomic upsert with increment - prevents race conditions
    const sequence = await this.prisma.studentCodeSequence.upsert({
      where: { year: currentYear },
      create: { year: currentYear, lastNumber: 1 },
      update: { lastNumber: { increment: 1 } },
    });

    if (sequence.lastNumber > MAX_SEQUENCE_NUMBER) {
      throw new ConflictException(
        `Student code sequence exhausted for year ${currentYear}.`,
      );
    }

    const paddedSequence = String(sequence.lastNumber).padStart(6, "0");
    return `${currentYear}-${paddedSequence}`;
  }
}
```

---

## Why Counter Table?

### Problem: Race Conditions

Without atomic operations, concurrent requests can generate duplicate codes:

```
Request A: SELECT MAX(code) → 000005
Request B: SELECT MAX(code) → 000005  (same value!)
Request A: INSERT code = 000006
Request B: INSERT code = 000006       (DUPLICATE!)
```

### Solution: Atomic Upsert

The `upsert` with `increment` is atomic at the database level:

```typescript
await prisma.studentCodeSequence.upsert({
  where: { year: currentYear },
  create: { year: currentYear, lastNumber: 1 },
  update: { lastNumber: { increment: 1 } },
});
```

- First request of the year: Creates row with `lastNumber = 1`
- Subsequent requests: Atomically increments `lastNumber`
- Year change: New row created, sequence resets to 1

---

## Usage in Use Case

```typescript
@Injectable()
export class CreateStudentUseCase {
  constructor(
    @Inject("STUDENT_REPOSITORY")
    private readonly studentRepository: StudentRepository,
    private readonly studentCodeGenerator: StudentCodeGeneratorService,
  ) {}

  async execute(input: CreateStudentInput): Promise<Student> {
    const studentCode = await this.studentCodeGenerator.generateNextCode();

    const student = Student.create({
      studentCode,
      fullName: input.fullName,
      // ... other fields
    });

    return await this.studentRepository.save(student);
  }
}
```

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| First student of year | Creates sequence row with `lastNumber = 1` |
| Year change (2025 → 2026) | New row created, resets to `2026-000001` |
| Concurrent requests | Atomic increment prevents duplicates |
| Student creation fails | Sequence number consumed (gap is OK) |
| Sequence > 999,999 | Throws `ConflictException` |

---

## Seeding Data

When seeding students, sync the sequence table afterward:

```typescript
// After seeding students
const currentYear = new Date().getFullYear();
const lastNumber = highestSequenceUsed;

await prisma.studentCodeSequence.upsert({
  where: { year: currentYear },
  create: { year: currentYear, lastNumber },
  update: { lastNumber },
});
```

See `seeds/seed-students.ts` and `seeds/sync-sequence.ts` for examples.

---

## Creating Similar Generators

For other entities needing sequential codes:

1. **Add counter table** in `schema.prisma`
2. **Create generator service** in `src/infra/persistence/prisma/services/`
3. **Inject in use case** and call `generateNextCode()`
4. **Register in module** providers

---

**Last Updated**: 2025-12-17
