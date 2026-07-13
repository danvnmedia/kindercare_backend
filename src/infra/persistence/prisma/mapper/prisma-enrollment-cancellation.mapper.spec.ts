import { Enrollment } from "@/domain/class-management/entities/enrollment.entity";
import { SchoolYearEnrollment } from "@/domain/class-management/entities/school-year-enrollment.entity";
import { EnrollmentCancellationReason } from "@/domain/class-management/enums/enrollment-cancellation-reason.enum";
import { PrismaEnrollmentMapper } from "./prisma-enrollment.mapper";
import { PrismaSchoolYearEnrollmentMapper } from "./prisma-school-year-enrollment.mapper";

describe("Prisma enrollment cancellation mappers", () => {
  const cancelledAt = new Date("2026-07-11T15:30:00.000Z");
  const commonCancellation = {
    cancelledAt,
    cancellationReason: EnrollmentCancellationReason.FAMILY_REQUEST,
    cancellationNote: "Family moved",
    cancelledByUserId: "11111111-1111-4111-a111-111111111111",
    cancelledByFullName: "Casey Admin",
  };

  it("round-trips child cancellation facts", () => {
    const entity = Enrollment.create(
      {
        classId: "22222222-2222-4222-a222-222222222222",
        studentId: "33333333-3333-4333-a333-333333333333",
        schoolYearEnrollmentId: "44444444-4444-4444-a444-444444444444",
        enrollmentDate: new Date("2026-09-01T00:00:00.000Z"),
        historicalFinalizedAt: cancelledAt,
        ...commonCancellation,
      },
      "55555555-5555-4555-a555-555555555555",
    );

    const prisma = PrismaEnrollmentMapper.toPrisma(entity);
    expect(prisma).toMatchObject(commonCancellation);

    const roundTrip = PrismaEnrollmentMapper.toDomainSimple({
      ...prisma,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    } as never);
    expect(roundTrip.cancelledAt).toEqual(cancelledAt);
    expect(roundTrip.cancellationReason).toBe(
      EnrollmentCancellationReason.FAMILY_REQUEST,
    );
    expect(roundTrip.cancelledByFullName).toBe("Casey Admin");
  });

  it("round-trips parent cancellation facts", () => {
    const entity = SchoolYearEnrollment.create(
      {
        studentId: "33333333-3333-4333-a333-333333333333",
        campusId: "66666666-6666-4666-a666-666666666666",
        schoolYearId: "77777777-7777-4777-a777-777777777777",
        gradeLevelId: "88888888-8888-4888-a888-888888888888",
        enrollmentDate: new Date("2026-09-01T00:00:00.000Z"),
        historicalFinalizedAt: cancelledAt,
        ...commonCancellation,
      },
      "44444444-4444-4444-a444-444444444444",
    );

    const prisma = PrismaSchoolYearEnrollmentMapper.toPrisma(entity);
    expect(prisma).toMatchObject(commonCancellation);

    const roundTrip = PrismaSchoolYearEnrollmentMapper.toDomainSimple({
      ...prisma,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    } as never);
    expect(roundTrip.cancelledAt).toEqual(cancelledAt);
    expect(roundTrip.cancellationReason).toBe(
      EnrollmentCancellationReason.FAMILY_REQUEST,
    );
    expect(roundTrip.cancelledByUserId).toBe(
      "11111111-1111-4111-a111-111111111111",
    );
  });
});
