/**
 * Controller-level test for AC-9 (write side) of @doc/specs/admin-audit-log:
 *
 * "Controller layer captures `currentUser.id` from the auth context and
 * threads it through the use case."
 *
 * Verifies one representative write endpoint (POST /students) — the same
 * `@CurrentUser()` decorator + threading pattern applies to all 19 wired
 * use cases.
 */
import { StudentController } from "./student.controller";
import { CreateStudentUseCase } from "@/application/user-management/use-cases/student/create-student.use-case";
import { User } from "@/domain/user-management/user.entity";

describe("StudentController — currentUser plumbing (AC-9)", () => {
  it("threads @CurrentUser into createStudentUseCase.execute", async () => {
    const createUseCase = {
      execute: jest.fn().mockResolvedValue({ id: "student-1" }),
    } as unknown as jest.Mocked<CreateStudentUseCase>;

    const noop = { execute: jest.fn() } as never;
    const controller = new StudentController(
      createUseCase,
      noop,
      noop,
      noop,
      noop,
      noop,
      noop,
      noop,
      noop,
      noop,
    );

    const currentUser = User.reconstitute(
      {
        clerkUid: "user_audit12345",
        isActive: true,
        profile: {
          type: "staff",
          id: "actor-1",
          fullName: "Alice Nguyen",
          email: null,
          phoneNumber: null,
          dateOfBirth: null,
          gender: null,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      "actor-1",
    );

    const dto = { fullName: "Eli Pham" } as never;

    await controller.create(
      "11111111-1111-4111-a111-111111111111",
      dto,
      currentUser,
    );

    expect(createUseCase.execute).toHaveBeenCalledTimes(1);
    const [, threadedUser] = createUseCase.execute.mock.calls[0]!;
    expect(threadedUser).toBe(currentUser);
    expect(threadedUser.id).toBe("actor-1");
  });
});
