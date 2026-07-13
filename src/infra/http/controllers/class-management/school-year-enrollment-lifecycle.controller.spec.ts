import "reflect-metadata";

import { RequestMethod } from "@nestjs/common";
import {
  GUARDS_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from "@nestjs/common/constants";
import { DECORATORS } from "@nestjs/swagger";

import { CancelSchoolYearEnrollmentUseCase } from "@/application/class-management/use-cases/school-year-enrollment/cancel-school-year-enrollment.use-case";
import { WithdrawFromSchoolUseCase } from "@/application/class-management/use-cases/school-year-enrollment/withdraw-from-school.use-case";
import { Enrollment } from "@/domain/class-management/entities/enrollment.entity";
import { SchoolYearEnrollment } from "@/domain/class-management/entities/school-year-enrollment.entity";
import { EnrollmentCancellationReason } from "@/domain/class-management/enums/enrollment-cancellation-reason.enum";
import { EnrollmentEffectiveStatus } from "@/domain/class-management/enums/enrollment-effective-status.enum";
import { createUser } from "@/test-utils";

import { REQUIRE_CAMPUS_ACCESS_KEY } from "../../decorators";
import { PERMISSIONS_KEY } from "../../decorators/permissions.decorator";
import { CampusGuard } from "../../guards/campus.guard";
import { ClerkAuthGuard } from "../../guards/clerk-auth.guard";
import { PermissionsGuard } from "../../guards/permissions.guard";
import { SchoolYearEnrollmentLifecycleController } from "./school-year-enrollment-lifecycle.controller";
import {
  CancellationBadRequestResponse,
  CancellationForbiddenResponse,
  CancellationNotFoundResponse,
  CancelSchoolYearEnrollmentConflictResponse,
} from "../../dtos/class-management";

describe("SchoolYearEnrollmentLifecycleController", () => {
  const now = new Date("2026-07-11T16:30:00.000Z");
  const user = createUser({ id: "actor-1" });
  let controller: SchoolYearEnrollmentLifecycleController;
  let cancelUseCase: jest.Mocked<CancelSchoolYearEnrollmentUseCase>;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(now);
    cancelUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<CancelSchoolYearEnrollmentUseCase>;
    controller = new SchoolYearEnrollmentLifecycleController(
      { execute: jest.fn() } as unknown as WithdrawFromSchoolUseCase,
      cancelUseCase,
    );
  });

  afterEach(() => jest.useRealTimers());

  it("wires JWT, campus-first guards, and the selected-campus cancellation permission", () => {
    const handler = SchoolYearEnrollmentLifecycleController.prototype.cancel;

    expect(
      Reflect.getMetadata(
        GUARDS_METADATA,
        SchoolYearEnrollmentLifecycleController,
      ),
    ).toContain(ClerkAuthGuard);
    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(":id/cancel");
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(
      RequestMethod.POST,
    );
    expect(Reflect.getMetadata(REQUIRE_CAMPUS_ACCESS_KEY, handler)).toEqual({});
    expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toEqual([
      CampusGuard,
      PermissionsGuard,
    ]);
    expect(Reflect.getMetadata(PERMISSIONS_KEY, handler)).toEqual([
      "school_year_enrollment.cancel",
    ]);

    const responses = Reflect.getMetadata(DECORATORS.API_RESPONSE, handler);
    expect(responses[400].type).toBe(CancellationBadRequestResponse);
    expect(responses[403].type).toBe(CancellationForbiddenResponse);
    expect(responses[404].type).toBe(CancellationNotFoundResponse);
    expect(responses[409].type).toBe(
      CancelSchoolYearEnrollmentConflictResponse,
    );
  });

  it("delegates the scoped request and returns authoritative cancellation projections", async () => {
    const parent = SchoolYearEnrollment.create(
      {
        studentId: "student-1",
        campusId: "campus-1",
        schoolYearId: "year-1",
        gradeLevelId: "grade-1",
        enrollmentDate: new Date("2026-09-01T00:00:00.000Z"),
      },
      "parent-1",
    ).cancel({
      cancelledAt: now,
      reason: EnrollmentCancellationReason.FAMILY_REQUEST,
      note: "family plans changed",
      actorId: user.id,
      actorFullName: "Alice Admin",
    });
    const child = Enrollment.create(
      {
        classId: "class-1",
        studentId: "student-1",
        schoolYearEnrollmentId: parent.id,
        enrollmentDate: new Date("2026-09-01T00:00:00.000Z"),
      },
      "child-1",
    ).cancel({
      cancelledAt: now,
      reason: EnrollmentCancellationReason.FAMILY_REQUEST,
      note: "family plans changed",
      actorId: user.id,
      actorFullName: "Alice Admin",
    });
    cancelUseCase.execute.mockResolvedValue({
      resultStatus: EnrollmentEffectiveStatus.CANCELLED,
      parent,
      affectedChildren: [child],
      affectedChildIds: [child.id],
      affectedChildCount: 1,
      idempotentReplay: false,
    });

    const result = await controller.cancel(
      "campus-1",
      parent.id,
      {
        cancellationReason: EnrollmentCancellationReason.FAMILY_REQUEST,
        note: "family plans changed",
      },
      user,
    );

    expect(cancelUseCase.execute).toHaveBeenCalledWith(
      {
        id: parent.id,
        campusId: "campus-1",
        cancellationReason: EnrollmentCancellationReason.FAMILY_REQUEST,
        note: "family plans changed",
      },
      user,
    );
    expect(result).toMatchObject({
      resultStatus: EnrollmentEffectiveStatus.CANCELLED,
      parent: {
        id: parent.id,
        effectiveStatus: EnrollmentEffectiveStatus.CANCELLED,
        cancellationReason: EnrollmentCancellationReason.FAMILY_REQUEST,
        cancellationNote: "family plans changed",
        cancelledBy: { id: user.id, fullName: "Alice Admin" },
      },
      affectedChildren: [
        {
          id: child.id,
          effectiveStatus: EnrollmentEffectiveStatus.CANCELLED,
          cancelledBy: { id: user.id, fullName: "Alice Admin" },
        },
      ],
      affectedChildIds: [child.id],
      affectedChildCount: 1,
      idempotentReplay: false,
    });
  });

  it("preserves authoritative replay metadata", async () => {
    const parent = SchoolYearEnrollment.create(
      {
        studentId: "student-1",
        campusId: "campus-1",
        schoolYearId: "year-1",
        gradeLevelId: "grade-1",
        enrollmentDate: new Date("2026-09-01T00:00:00.000Z"),
      },
      "parent-1",
    ).cancel({
      cancelledAt: now,
      reason: EnrollmentCancellationReason.OTHER,
      actorId: user.id,
    });
    cancelUseCase.execute.mockResolvedValue({
      resultStatus: EnrollmentEffectiveStatus.CANCELLED,
      parent,
      affectedChildren: [],
      affectedChildIds: [],
      affectedChildCount: 0,
      idempotentReplay: true,
    });

    const result = await controller.cancel(
      "campus-1",
      parent.id,
      { cancellationReason: EnrollmentCancellationReason.OTHER },
      user,
    );

    expect(result.idempotentReplay).toBe(true);
    expect(result.parent.cancelledAt).toEqual(now);
    expect(result.parent.cancellationNote).toBeNull();
    expect(result.affectedChildren).toEqual([]);
  });
});
