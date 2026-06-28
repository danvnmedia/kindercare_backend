import { plainToInstance } from "class-transformer";

import { StaffResponse } from "./staff.response";

/**
 * Spec AC-6 of @doc/specs/staff-multi-type-refactor: GET /staff and
 * GET /staff/:id must surface `staffTypes: StaffTypeSummaryDto[]` (nested
 * `{ id, name }` snapshots) and must NOT leak the legacy `staffTypeId` /
 * `staffType` fields on the wire. Both endpoints flow through
 * StandardResponseInterceptor, which uses
 * `plainToInstance(StaffResponse, ..., { excludeExtraneousValues: true })`
 * to convert the domain entity into the wire DTO.
 *
 * Locks D1 (nested summary shape), D3 (no array cap — empty + multi-element
 * cases), D4 (min-1 is enforced at the WRITE path, not the read path — the
 * DTO transform must still surface empty arrays for legacy migrated rows
 * per D5), and D6 (atomic switch — no compat shim, legacy keys stripped).
 *
 * SCOPE NOTE: like `student.response.spec.ts`, this test does not boot a
 * NestJS testing module / supertest. The interceptor itself is covered by
 * its own module's tests. Here we verify only the `@Expose()`-decorated
 * DTO shape that the interceptor feeds into class-transformer. The
 * upstream sort by `StaffType.order ASC` lives in
 * `prisma-staff.mapper.ts` and is covered there.
 */
describe("StaffResponse (HTTP surface — Spec AC-6 + D1, D3, D4, D6)", () => {
  const baseEntity = {
    id: "11111111-1111-4111-a111-111111111111",
    campusId: "22222222-2222-4222-a222-222222222222",
    staffCode: "ST-2025-000001",
    fullName: "Nguyễn Văn A",
    email: "staff@example.com",
    phoneNumber: "+84912345678",
    address: null,
    dateOfBirth: null,
    gender: null,
    userId: null,
    isArchived: false,
    createdAt: new Date("2026-05-27T00:00:00.000Z"),
    updatedAt: new Date("2026-05-27T00:00:00.000Z"),
  };

  const transform = (source: Record<string, unknown>) =>
    plainToInstance(StaffResponse, source, {
      excludeExtraneousValues: true,
    });

  describe("staffTypes array exposure (Spec AC-6 / D1)", () => {
    it("exposes an empty staffTypes array for a legacy migrated row (D5 — zero join rows)", () => {
      // Per D5 of the spec, legacy staff with `staff_type_id IS NULL` migrate
      // to ZERO join rows. The write path enforces min-1 (D4), but the read
      // path must still surface the existing data without throwing or
      // synthesizing a sentinel — the FE handles the "0 types, pick one"
      // editing UX (per FE handoff).
      const response = transform({ ...baseEntity, staffTypes: [] });

      expect(response.staffTypes).toEqual([]);
    });

    it("projects a single staffType to the {id, name} summary shape", () => {
      const response = transform({
        ...baseEntity,
        staffTypes: [{ id: "stype-1", name: "Teacher" }],
      });

      expect(response.staffTypes).toEqual([{ id: "stype-1", name: "Teacher" }]);
    });

    it("projects multiple staffTypes preserving caller-provided order (sort applied upstream)", () => {
      // The DTO transform itself does NOT sort — sort by `StaffType.order
      // ASC` is the responsibility of the upstream mapper
      // (`prisma-staff.mapper.ts`). The lock here is that
      // `excludeExtraneousValues` does not reorder the array.
      const response = transform({
        ...baseEntity,
        staffTypes: [
          { id: "stype-1", name: "Teacher" },
          { id: "stype-2", name: "Vice President" },
          { id: "stype-3", name: "Nurse" },
        ],
      });

      expect(response.staffTypes).toEqual([
        { id: "stype-1", name: "Teacher" },
        { id: "stype-2", name: "Vice President" },
        { id: "stype-3", name: "Nurse" },
      ]);
    });

    it("strips extra fields from each StaffTypeSnapshot (only {id, name} survives the summary projection)", () => {
      // `StaffTypeSnapshot` may legitimately carry extra fields (or test
      // fixtures might leak them); the wire surface is strictly `{id, name}`
      // per `StaffTypeSummaryDto`. `@Type(() => StaffTypeSummaryDto)` plus
      // `excludeExtraneousValues` should guarantee the trim.
      const response = transform({
        ...baseEntity,
        staffTypes: [
          {
            id: "stype-1",
            name: "Teacher",
            order: 1,
            defaultRoleId: "role-x",
            isArchived: false,
          },
        ],
      });

      expect(response.staffTypes).toEqual([{ id: "stype-1", name: "Teacher" }]);
      // Structural negative: extra StaffType fields must not bleed through.
      expect(response.staffTypes[0]).not.toHaveProperty("order");
      expect(response.staffTypes[0]).not.toHaveProperty("defaultRoleId");
      expect(response.staffTypes[0]).not.toHaveProperty("isArchived");
    });
  });

  describe("legacy field stripping (D6 — atomic switch, no compat shim)", () => {
    it("strips legacy `staffTypeId` from the source payload (no compat field on the wire)", () => {
      const response = transform({
        ...baseEntity,
        staffTypes: [{ id: "stype-1", name: "Teacher" }],
        // Source defensively carries the legacy scalar — must NOT survive.
        staffTypeId: "stype-1",
      });

      expect(response).not.toHaveProperty("staffTypeId");
    });

    it("strips legacy `staffType` scalar relation from the source payload (no compat field on the wire)", () => {
      const response = transform({
        ...baseEntity,
        staffTypes: [{ id: "stype-1", name: "Teacher" }],
        // Source defensively carries the legacy single nested snapshot — must
        // NOT survive. The new contract is `staffTypes: []` only.
        staffType: { id: "stype-1", name: "Teacher" },
      });

      expect(response).not.toHaveProperty("staffType");
    });
  });

  describe("orthogonal fields survive the transform", () => {
    it("surfaces every @Expose()-decorated identity + profile field unchanged", () => {
      const response = transform({
        ...baseEntity,
        staffTypes: [{ id: "stype-1", name: "Teacher" }],
        address: "123 Đường ABC",
        dateOfBirth: new Date("1990-01-15T00:00:00.000Z"),
        gender: "MALE",
        userId: "44444444-4444-4444-a444-444444444444",
        isArchived: true,
      });

      expect(response.id).toBe(baseEntity.id);
      expect(response.campusId).toBe(baseEntity.campusId);
      expect(response.staffCode).toBe(baseEntity.staffCode);
      expect(response.fullName).toBe(baseEntity.fullName);
      expect(response.email).toBe(baseEntity.email);
      expect(response.phoneNumber).toBe(baseEntity.phoneNumber);
      expect(response.address).toBe("123 Đường ABC");
      expect(response.dateOfBirth).toEqual(
        new Date("1990-01-15T00:00:00.000Z"),
      );
      expect(response.gender).toBe("MALE");
      expect(response.userId).toBe("44444444-4444-4444-a444-444444444444");
      expect(response.isArchived).toBe(true);
      expect(response.createdAt).toEqual(baseEntity.createdAt);
      expect(response.updatedAt).toEqual(baseEntity.updatedAt);
      expect(response).not.toHaveProperty("startDate");
    });
  });
});
