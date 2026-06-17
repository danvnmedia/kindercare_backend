import {
  Staff as PrismaStaff,
  StaffStaffType as PrismaStaffStaffType,
  StaffType as PrismaStaffType,
} from "@prisma/client";

import { Gender } from "@/domain/user-management/enums/gender.enum";

import { PrismaStaffMapper } from "./prisma-staff.mapper";

const baseRow = (): PrismaStaff => ({
  id: "33333333-3333-4333-a333-333333333333",
  campusId: "11111111-1111-4111-a111-111111111111",
  staffCode: "ST-2025-000001",
  fullName: "Nguyễn Văn A",
  email: "staff@example.com",
  phoneNumber: "+84912345678",
  address: null,
  dateOfBirth: null,
  gender: null,
  userId: null,
  isArchived: false,
  createdAt: new Date("2025-01-01T00:00:00.000Z"),
  updatedAt: new Date("2025-01-01T00:00:00.000Z"),
});

const staffTypeRow = (
  overrides: Partial<PrismaStaffType> = {},
): PrismaStaffType => ({
  id: "44444444-4444-4444-a444-444444444444",
  campusId: "11111111-1111-4111-a111-111111111111",
  name: "Teacher",
  description: null,
  defaultRoleId: null,
  isArchived: false,
  order: 0,
  createdAt: new Date("2025-01-01T00:00:00.000Z"),
  updatedAt: new Date("2025-01-01T00:00:00.000Z"),
  ...overrides,
});

const joinRow = (
  staffType: PrismaStaffType,
  staffId = baseRow().id,
): PrismaStaffStaffType & { staffType: PrismaStaffType } => ({
  staffId,
  staffTypeId: staffType.id,
  createdAt: new Date("2025-01-01T00:00:00.000Z"),
  staffType,
});

describe("PrismaStaffMapper", () => {
  describe("toDomain", () => {
    it("returns an empty staffTypes collection when no join rows are eager-loaded", () => {
      const staff = PrismaStaffMapper.toDomain({
        ...baseRow(),
        staffTypes: [],
      });

      expect(staff.staffTypes).toEqual([]);
    });

    it("returns an empty staffTypes collection when the staffTypes key is absent (relation not requested)", () => {
      // Defensive: the mapper should not assume the include was requested.
      const staff = PrismaStaffMapper.toDomain(baseRow());

      expect(staff.staffTypes).toEqual([]);
    });

    it("projects a single join row to a [{ id, name }] snapshot", () => {
      const teacher = staffTypeRow({ name: "Teacher", order: 0 });

      const staff = PrismaStaffMapper.toDomain({
        ...baseRow(),
        staffTypes: [joinRow(teacher)],
      });

      expect(staff.staffTypes).toEqual([{ id: teacher.id, name: "Teacher" }]);
    });

    it("sorts multi-type joins by StaffType.order ASC regardless of input order", () => {
      // Input deliberately scrambled to prove the sort, not the iteration order.
      const vp = staffTypeRow({
        id: "55555555-5555-4555-a555-555555555555",
        name: "Vice President",
        order: 2,
      });
      const principal = staffTypeRow({
        id: "66666666-6666-4666-a666-666666666666",
        name: "Principal",
        order: 1,
      });
      const teacher = staffTypeRow({
        id: "44444444-4444-4444-a444-444444444444",
        name: "Teacher",
        order: 0,
      });

      const staff = PrismaStaffMapper.toDomain({
        ...baseRow(),
        staffTypes: [joinRow(vp), joinRow(principal), joinRow(teacher)],
      });

      expect(staff.staffTypes).toEqual([
        { id: teacher.id, name: "Teacher" },
        { id: principal.id, name: "Principal" },
        { id: vp.id, name: "Vice President" },
      ]);
    });

    it("defensively skips join rows whose staffType is null (stale relation shape)", () => {
      const teacher = staffTypeRow({ name: "Teacher", order: 0 });
      // Simulate a malformed eager-load where one join row lost its nested
      // StaffType (e.g. partial select; should never happen on the canonical
      // include shape, but the mapper must not crash).
      const broken = {
        staffId: baseRow().id,
        staffTypeId: "deadbeef-dead-4dead-deadbeefdead",
        createdAt: new Date("2025-01-01T00:00:00.000Z"),
        staffType: null as unknown as PrismaStaffType,
      };

      const staff = PrismaStaffMapper.toDomain({
        ...baseRow(),
        staffTypes: [joinRow(teacher), broken],
      });

      expect(staff.staffTypes).toEqual([{ id: teacher.id, name: "Teacher" }]);
    });

    it("does not forward unrelated StaffType fields into the snapshot", () => {
      const staff = PrismaStaffMapper.toDomain({
        ...baseRow(),
        staffTypes: [joinRow(staffTypeRow())],
      });

      // Snapshot is intentionally narrow — see StaffTypeSnapshot.
      expect(Object.keys(staff.staffTypes[0]).sort()).toEqual(["id", "name"]);
    });

    it("preserves gender casting and base fields untouched", () => {
      const row = baseRow();
      row.gender = "FEMALE";

      const staff = PrismaStaffMapper.toDomain(row);

      expect(staff.gender).toBe(Gender.FEMALE);
      expect(staff.fullName).toBe("Nguyễn Văn A");
      expect(staff.email).toBe("staff@example.com");
    });
  });

  describe("toDomainSimple", () => {
    it("hydrates staffTypes as [] regardless of relations on the row", () => {
      // toDomainSimple takes a bare PrismaStaff — the collection stays empty
      // because the simple variant intentionally does not eager-load the
      // `staff_staff_type` join.
      const staff = PrismaStaffMapper.toDomainSimple(baseRow());
      expect(staff.staffTypes).toEqual([]);
    });
  });
});
