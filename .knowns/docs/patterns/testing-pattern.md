---
title: Testing Pattern
description: Unit tests using entity factories + mock repository factories from src/test-utils, with examples for use cases, entities, and integration tests
createdAt: '2026-05-05T17:51:37.112Z'
updatedAt: '2026-05-05T17:51:37.112Z'
tags:
  - patterns
  - testing
  - unit-test
  - integration-test
  - jest
---

# Testing Pattern

> Unit and integration tests with Jest. Test utilities live at `src/test-utils/`.

The codebase uses Jest with `ts-jest`, configured in `package.json`. Test files live next to source as `*.spec.ts`, integration tests as `*.integration.spec.ts`. The test runner picks up both via `testRegex: ".*\\.spec\\.ts$"`.

## Three Layers of Tests

| Layer | What | Example |
|-------|------|---------|
| **Domain** | Pure entity tests — invariants, lifecycle methods | `student.entity.spec.ts` |
| **Application** | Use case tests with mocked repositories and ports | `archive-student.use-case.spec.ts` |
| **Integration** | Cross-module behaviour with the test module compiled | `campus-isolation.integration.spec.ts` |

There are no E2E HTTP tests in the current suite (the boilerplate ships `test/jest-e2e.json` for them, but no specs).

## `src/test-utils/`

Two helpers reduce boilerplate dramatically:

```
src/test-utils/
├── entity-factories.ts          # createCampus, createStaff, createStudent, …
├── mock-repository-factory.ts   # createMockStudentRepository, … (jest.Mocked)
└── index.ts
```

### Entity factories

Every domain entity has a `createXxx(overrides?)` factory in `entity-factories.ts`. Sensible defaults so you only specify what matters:

```typescript
import { createStaff, DEFAULT_CAMPUS_ID_A } from "@/test-utils";

const staff = createStaff();                                    // generates a valid Staff
const archived = createStaff({ isArchived: true });             // override one field
const inOtherCampus = createStaff({ campusId: DEFAULT_CAMPUS_ID_B });
```

Two campus IDs (`DEFAULT_CAMPUS_ID_A`, `DEFAULT_CAMPUS_ID_B`) are exported so cross-campus tests have stable values.

### Mock repository factories

Each repository has a `createMockXxxRepository()` helper that returns a `jest.Mocked<XxxRepository>` with every method stubbed:

```typescript
import { createMockStudentRepository } from "@/test-utils";

const studentRepo = createMockStudentRepository();
studentRepo.findById.mockResolvedValue(createStudent({ id: "abc" }));
studentRepo.findByEmailInCampus.mockResolvedValue(null);
```

This means the use case test only configures the methods it cares about; the rest stay `jest.fn()` and throw `undefined` if called by accident — useful for catching unintended calls.

## Domain Entity Test

Test the factory invariants and the lifecycle methods.

```typescript
// src/domain/user-management/entities/student.entity.spec.ts
describe("Student.create", () => {
  it("requires campusId", () => {
    expect(() => Student.create({ ...validProps, campusId: "" })).toThrow("Campus ID is required");
  });

  it("requires fullName at least 2 chars", () => {
    expect(() => Student.create({ ...validProps, fullName: "X" })).toThrow();
  });

  it("defaults status to ACTIVE", () => {
    const student = Student.create({ ...validProps });
    expect(student.status).toBe(StudentStatus.ACTIVE);
  });
});

describe("Student.archive", () => {
  it("sets isArchived and resets status to DROPPED", () => {
    const student = createStudent({ status: StudentStatus.ACTIVE });
    student.archive();
    expect(student.isArchived).toBe(true);
    expect(student.status).toBe(StudentStatus.DROPPED);
  });
});
```

Domain tests have **no DI**, no Jest module compilation. They're fast and independent.

## Use Case Test

Mock all dependencies, instantiate the use case, exercise behaviour.

```typescript
// archive-student.use-case.spec.ts
describe("ArchiveStudentUseCase", () => {
  let useCase: ArchiveStudentUseCase;
  let studentRepo: jest.Mocked<StudentRepository>;

  beforeEach(() => {
    studentRepo = createMockStudentRepository();
    useCase = new ArchiveStudentUseCase(studentRepo);
  });

  it("archives an active student", async () => {
    const student = createStudent({ id: "s1", status: StudentStatus.ACTIVE, campusId: DEFAULT_CAMPUS_ID_A });
    studentRepo.findById.mockResolvedValue(student);

    const result = await useCase.execute("s1", DEFAULT_CAMPUS_ID_A);

    expect(result.isArchived).toBe(true);
    expect(studentRepo.update).toHaveBeenCalledWith(expect.objectContaining({ isArchived: true }));
  });

  it("rejects cross-campus access", async () => {
    const student = createStudent({ id: "s1", campusId: DEFAULT_CAMPUS_ID_A });
    studentRepo.findById.mockResolvedValue(student);

    await expect(useCase.execute("s1", DEFAULT_CAMPUS_ID_B)).rejects.toThrow(NotFoundException);
  });
});
```

Use cases that depend on `UnitOfWorkPort`, `IdentityPort`, or queue services need their own mocks — instantiate directly:

```typescript
const identityPort: jest.Mocked<IdentityPort> = {
  provisionUser: jest.fn(),
  updateUser: jest.fn(),
  deleteIdentity: jest.fn(),
  inviteUser: jest.fn(),
  lockIdentity: jest.fn(),
  unlockIdentity: jest.fn(),
} as any;

const unitOfWork: jest.Mocked<UnitOfWorkPort> = {
  run: jest.fn().mockImplementation(async (fn) => fn(mockTransactionContext)),
};
```

For sagas, assert that:

1. Forward action was called with the right input.
2. UoW received the right callback shape.
3. On simulated DB failure, compensation was called.

```typescript
it("compensates Clerk user when DB transaction fails", async () => {
  identityPort.provisionUser.mockResolvedValue({ clerkUid: "user_xyz" });
  unitOfWork.run.mockRejectedValue(new Error("DB down"));

  await expect(useCase.execute(input)).rejects.toThrow();
  expect(identityPort.deleteIdentity).toHaveBeenCalledWith("user_xyz");
});
```

## Integration Test

When behaviour spans multiple modules and you want a compiled Nest module:

```typescript
// rbac-campus-scoping.integration.spec.ts
describe("RBAC campus scoping (integration)", () => {
  let module: TestingModule;
  let useCase: AssignPermissionsToRoleUseCase;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [RbacModule, /* … */],
    }).compile();

    useCase = module.get(AssignPermissionsToRoleUseCase);
  });

  // …
});
```

Use sparingly — they're slower and need real Prisma. Reach for them when:

- Multiple modules' wiring needs verification.
- A behaviour requires the full request pipeline (guards + interceptors).
- A bug only repros with real Prisma + a transaction.

Existing integration specs:

- `src/application/campus/use-cases/campus-isolation.integration.spec.ts`
- `src/application/rbac/use-cases/rbac-campus-scoping.integration.spec.ts`

## Cross-Campus Prevention Tests

Every campus-scoped use case should have a test that asserts cross-campus access is rejected. The shape:

```typescript
it("rejects access from a different campus", async () => {
  const entity = createXxx({ campusId: DEFAULT_CAMPUS_ID_A });
  repo.findById.mockResolvedValue(entity);

  await expect(useCase.execute(entity.id, DEFAULT_CAMPUS_ID_B))
    .rejects.toThrow(NotFoundException);  // or BadRequestException, depending on the use case
});
```

This protects against regressions where a `where: { id }` clause loses the `campusId` filter.

## What NOT to Test

| Skip | Why |
|------|-----|
| Trivial getters | Generated at compile time; no logic to break |
| Prisma mappers, except `toPrismaUpdate` | Trivial field copying — covered transitively by repository tests |
| The interceptor chain (StandardResponse, ValidationPipe) | NestJS's responsibility |
| External libraries (Clerk SDK, BullMQ) | They have their own tests |
| Shape of `class-validator` error messages | Brittle; the pipe is the contract |

## Test File Layout

```
src/domain/user-management/entities/student.entity.ts
src/domain/user-management/entities/student.entity.spec.ts          ← unit
src/application/user-management/use-cases/student/archive-student.use-case.ts
src/application/user-management/use-cases/student/archive-student.use-case.spec.ts ← unit
src/application/campus/use-cases/campus-isolation.integration.spec.ts ← integration
```

## Pitfalls

| Mistake | Symptom |
|---------|---------|
| Creating a fresh entity in the test instead of using `createStaff(...)` | Tests drift; defaults change in one place but not others |
| Sharing mock state across tests | One test pollutes the next; reset with `beforeEach` |
| Using real Date in assertions | Flaky on slow machines; freeze with `jest.useFakeTimers()` |
| Mocking the use case under test | Only mock its dependencies |
| Asserting on log output | Logs are infrastructure; assert on side effects |
| Writing integration tests for everything | Slow suites discourage running them — keep them targeted |

## Running Tests

```
npm run test                # full suite
npm run test:watch          # watch mode
npm run test:cov            # with coverage
npm run test -- student     # filter by file pattern
npm run test -- -t "archive" # filter by test name
```

## Reference

| File | Notes |
|------|-------|
| `src/test-utils/entity-factories.ts` | All `createXxx(overrides?)` helpers |
| `src/test-utils/mock-repository-factory.ts` | All `createMockXxxRepository()` helpers |
| `src/domain/user-management/entities/student.entity.spec.ts` | Entity invariant + method tests |
| `src/application/user-management/use-cases/student/archive-student.use-case.spec.ts` | Use case test pattern |
| `src/application/campus/use-cases/campus-isolation.integration.spec.ts` | Integration pattern |
| `package.json` (`jest` block) | Test runner config |
