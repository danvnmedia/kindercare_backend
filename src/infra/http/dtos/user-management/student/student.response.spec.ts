import { plainToInstance } from "class-transformer";

import { StudentResponse } from "./student.response";

/**
 * Spec AC-17: GET /students and GET /students/:id must populate `phase`
 * per the D6 taxonomy. Both endpoints flow through StandardResponseInterceptor,
 * which uses `plainToInstance(StudentResponse, ..., { excludeExtraneousValues })`
 * to convert the domain entity into the wire DTO. This spec asserts that the
 * `phase` field and the orthogonal `isArchived` flag survive that transform
 * for every value from the D6 taxonomy.
 *
 * SCOPE NOTE: the test does not boot a NestJS testing module / supertest —
 * the StandardResponseInterceptor is exercised by its own module's tests.
 * Here we verify only the `@Expose()`-decorated DTO shape that the interceptor
 * feeds into class-transformer. The actual SQL CASE that derives `phase`
 * is verified manually against a dev DB after migration; the mapper-level
 * projection seam is covered in `prisma-student.repository.spec.ts`.
 */
describe("StudentResponse (HTTP surface — Spec AC-17, AC-23)", () => {
  const baseEntity = {
    id: "11111111-1111-4111-a111-111111111111",
    campusId: "22222222-2222-4222-a222-222222222222",
    studentCode: "2025-000001",
    fullName: "Nguyễn Văn A",
    email: null,
    phoneNumber: null,
    address: null,
    dateOfBirth: null,
    nickname: null,
    gender: null,
    isArchived: false,
    enrollmentDate: null,
    isOnTrack: true,
    classId: null,
    createdAt: new Date("2026-05-16T00:00:00.000Z"),
    updatedAt: new Date("2026-05-16T00:00:00.000Z"),
  };

  const transform = (source: Record<string, unknown>) =>
    plainToInstance(StudentResponse, source, {
      excludeExtraneousValues: true,
    });

  describe("phase exposure across the D6 taxonomy (AC-17)", () => {
    it.each([
      ["WAITING"],
      ["ACTIVE"],
      ["DEFERRED"],
      ["GRADUATED"],
      ["WITHDRAWN"],
    ])("exposes phase=%s on the response payload", (phase) => {
      const response = transform({ ...baseEntity, phase });

      expect(response.phase).toBe(phase);
    });

    it("preserves phase=null when the source has no phase (write-path read-back)", () => {
      // POST /students and PATCH /students/:id read back from the raw
      // `student` table (Spec D7 — view is read-only). The mapper returns
      // phase=undefined in that case; class-transformer leaves the field
      // untouched here. The interceptor surfaces undefined as null on the
      // JSON wire (consistent with `gender: string | null` etc.).
      const response = transform({ ...baseEntity, phase: null });

      expect(response.phase).toBeNull();
    });
  });

  describe("isArchived overlay (AC-23)", () => {
    it("surfaces isArchived=true alongside an underlying ACTIVE phase", () => {
      // Archive is orthogonal to phase (Spec D6): an archived student
      // with an open Enrollment surfaces isArchived=true AND phase=ACTIVE.
      // The overlay does not replace the phase on the response.
      const response = transform({
        ...baseEntity,
        isArchived: true,
        phase: "ACTIVE",
      });

      expect(response.isArchived).toBe(true);
      expect(response.phase).toBe("ACTIVE");
    });

    it("defaults isArchived=false for unarchived students", () => {
      const response = transform({ ...baseEntity, phase: "ACTIVE" });

      expect(response.isArchived).toBe(false);
    });
  });
});
