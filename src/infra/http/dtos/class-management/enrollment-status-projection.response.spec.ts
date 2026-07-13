import {
  instanceToPlain,
  plainToInstance,
  type ClassConstructor,
} from "class-transformer";

import { EnrollmentCancellationReason } from "@/domain/class-management/enums/enrollment-cancellation-reason.enum";
import { EnrollmentEffectiveStatus } from "@/domain/class-management/enums/enrollment-effective-status.enum";

import { SchoolYearEnrollmentSummaryResponse } from "./school-year-enrollment-summary.response";
import { SchoolYearStudentResponse } from "./school-year-student.response";
import { StudentEnrollmentHistoryResponse } from "./student-enrollment-history.response";

const cancellation = {
  effectiveStatus: EnrollmentEffectiveStatus.CANCELLED,
  cancelledAt: new Date("2026-07-11T12:00:00.000Z"),
  cancellationReason: EnrollmentCancellationReason.FAMILY_REQUEST,
  cancellationNote: "plans changed",
  cancelledBy: { id: "actor-1", fullName: "Alice Admin" },
};

describe("enrollment status response projections", () => {
  it.each([
    [StudentEnrollmentHistoryResponse, childSource()],
    [SchoolYearEnrollmentSummaryResponse, parentSource()],
    [SchoolYearStudentResponse, schoolYearStudentSource()],
  ] as const)(
    "%p exposes effective status and complete cancellation metadata",
    (ResponseType, source) => {
      const plain = serialize(ResponseType, source);

      expect(plain).toMatchObject({
        effectiveStatus: EnrollmentEffectiveStatus.CANCELLED,
        cancellationReason: EnrollmentCancellationReason.FAMILY_REQUEST,
        cancellationNote: "plans changed",
        cancelledBy: { id: "actor-1", fullName: "Alice Admin" },
      });
    },
  );

  it("serializes the clean-break class assignment state", () => {
    const plain = instanceToPlain(
      plainToInstance(SchoolYearStudentResponse, schoolYearStudentSource(), {
        excludeExtraneousValues: true,
      }),
    );

    expect(plain.classAssignmentState).toBe("CANCELLED");
    expect(plain.segment).toBe("registered");
  });
});

function serialize(ResponseType: ClassConstructor<object>, source: object) {
  return instanceToPlain(
    plainToInstance(ResponseType, source, { excludeExtraneousValues: true }),
  );
}

function childSource() {
  return {
    id: "child-1",
    classId: "class-1",
    studentId: "student-1",
    schoolYearEnrollmentId: "parent-1",
    enrollmentDate: new Date("2026-09-01T00:00:00.000Z"),
    endDate: null,
    exitReason: null,
    note: null,
    ...cancellation,
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    updatedAt: new Date("2026-07-11T12:00:00.000Z"),
  };
}

function parentSource() {
  return {
    id: "parent-1",
    studentId: "student-1",
    campusId: "campus-1",
    schoolYearId: "year-1",
    gradeLevelId: "grade-1",
    enrollmentDate: new Date("2026-09-01T00:00:00.000Z"),
    exitDate: null,
    exitReason: null,
    note: null,
    childEnrollmentCount: 0,
    ...cancellation,
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    updatedAt: new Date("2026-07-11T12:00:00.000Z"),
  };
}

function schoolYearStudentSource() {
  return {
    ...parentSource(),
    schoolYearEnrollmentId: "parent-1",
    segment: "registered",
    classAssignmentState: "CANCELLED",
    classAssignment: childSource(),
  };
}
