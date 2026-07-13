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
 * Spec @doc/specs/student-current-class-surfacing AC-9: the same transform
 * surfaces the `currentClass` snapshot (`{ id, name } | null`) projected from
 * the student_with_phase view, and falls back to null on write-path read-back.
 *
 * SCOPE NOTE: the test does not boot a NestJS testing module / supertest —
 * the StandardResponseInterceptor is exercised by its own module's tests.
 * Here we verify only the `@Expose()`-decorated DTO shape that the interceptor
 * feeds into class-transformer. The actual SQL CASE that derives `phase`
 * and the LEFT JOIN LATERAL that derives currentClass are verified manually
 * against a dev DB after migration; the mapper-level projection seam is
 * covered in `prisma-student.repository.spec.ts`.
 */
describe("StudentResponse (HTTP surface — Spec AC-17, AC-23, AC-9)", () => {
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
      ["COMPLETED"],
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

  describe("currentClass exposure (Spec AC-9)", () => {
    const classSnapshot = {
      id: "33333333-3333-4333-a333-333333333333",
      name: "Lớp Mầm 1A",
    };

    it("exposes currentClass={id,name} when the source carries an open-enrollment snapshot", () => {
      const response = transform({
        ...baseEntity,
        phase: "ACTIVE",
        currentClass: classSnapshot,
      });

      expect(response.currentClass).toEqual(classSnapshot);
    });

    it("preserves currentClass=null when the source explicitly sets null (no open enrollment)", () => {
      const response = transform({
        ...baseEntity,
        phase: "WITHDRAWN",
        currentClass: null,
      });

      expect(response.currentClass).toBeNull();
    });

    it("preserves currentClass=null alongside phase=null on the write-path read-back contract", () => {
      // POST /students and PATCH /students/:id read back from the raw
      // `student` table (Spec D3 — view is read-only). The T2 mapper's
      // extractCurrentClass narrowing returns null for raw-table rows
      // (no currentClassId column present), so the entity getter surfaces
      // null and the DTO transform preserves it on the wire — parallel to
      // the `phase: null` write-path contract verified above.
      const response = transform({
        ...baseEntity,
        phase: null,
        currentClass: null,
      });

      expect(response.phase).toBeNull();
      expect(response.currentClass).toBeNull();
    });
  });
});
