import {
  Staff as PrismaStaff,
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
  staffTypeId: null,
  address: null,
  dateOfBirth: null,
  gender: null,
  startDate: null,
  userId: null,
  isArchived: false,
  createdAt: new Date("2025-01-01T00:00:00.000Z"),
  updatedAt: new Date("2025-01-01T00:00:00.000Z"),
});

const staffTypeRow = (): PrismaStaffType => ({
  id: "44444444-4444-4444-a444-444444444444",
  campusId: "11111111-1111-4111-a111-111111111111",
  name: "Teacher",
  description: null,
  defaultRoleId: null,
  isArchived: false,
  order: 0,
  createdAt: new Date("2025-01-01T00:00:00.000Z"),
  updatedAt: new Date("2025-01-01T00:00:00.000Z"),
});

describe("PrismaStaffMapper", () => {
  describe("toDomain", () => {
    it("forwards the staffType relation as a { id, name } snapshot when loaded", () => {
      const row = baseRow();
      row.staffTypeId = staffTypeRow().id;

      const staff = PrismaStaffMapper.toDomain({
        ...row,
        staffType: staffTypeRow(),
      });

      expect(staff.staffType).toEqual({
        id: staffTypeRow().id,
        name: "Teacher",
      });
      expect(staff.staffTypeId).toBe(staffTypeRow().id);
    });

    it("returns null staffType when the relation is null on the loaded row", () => {
      const staff = PrismaStaffMapper.toDomain({
        ...baseRow(),
        staffType: null,
      });

      expect(staff.staffType).toBeNull();
    });

    it("returns null staffType when the relation key is absent (relation not requested)", () => {
      // No `staffType` key on the input — defensive: the mapper should not
      // assume the include was requested.
      const staff = PrismaStaffMapper.toDomain(baseRow());

      expect(staff.staffType).toBeNull();
    });

    it("does not forward unrelated StaffType fields into the snapshot", () => {
      const staff = PrismaStaffMapper.toDomain({
        ...baseRow(),
        staffType: staffTypeRow(),
      });

      // Snapshot is intentionally narrow — see StaffTypeSnapshot.
      expect(Object.keys(staff.staffType ?? {}).sort()).toEqual(["id", "name"]);
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
    it("never hydrates a staffType snapshot regardless of relations on the row", () => {
      // toDomainSimple takes a bare PrismaStaff — the snapshot stays null.
      const staff = PrismaStaffMapper.toDomainSimple(baseRow());
      expect(staff.staffType).toBeNull();
    });
  });
});
