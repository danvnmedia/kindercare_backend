import { Staff } from "./staff.entity";
import { Gender } from "../enums/gender.enum";

describe("Staff Entity", () => {
  const validCampusId = "123e4567-e89b-12d3-a456-426614174000";
  const validPhoneNumber = "+84901234567";
  const validEmail = "staff@example.com";
  const validStaffTypeId = "456e7890-e89b-12d3-a456-426614174000";
  const validStaffCode = "ST-2025-000001";

  describe("create", () => {
    it("should create a staff with required fields", () => {
      const staff = Staff.create({
        campusId: validCampusId,
        staffCode: validStaffCode,
        fullName: "John Doe",
        email: validEmail,
        phoneNumber: validPhoneNumber,
        address: null,
        dateOfBirth: null,
        gender: null,
        startDate: null,
      });

      expect(staff.campusId).toBe(validCampusId);
      expect(staff.fullName).toBe("John Doe");
      expect(staff.email).toBe(validEmail);
      expect(staff.phoneNumber).toBe(validPhoneNumber);
      expect(staff.address).toBeNull();
      expect(staff.dateOfBirth).toBeNull();
      expect(staff.gender).toBeNull();
      expect(staff.startDate).toBeNull();
      expect(staff.staffTypeId).toBeNull();
      expect(staff.userId).toBeNull();
      expect(staff.isArchived).toBe(false);
      expect(staff.id).toBeDefined();
      expect(staff.createdAt).toBeInstanceOf(Date);
      expect(staff.updatedAt).toBeInstanceOf(Date);
    });

    it("should create a staff with all fields", () => {
      const dateOfBirth = new Date("1985-03-15");
      const startDate = new Date("2023-01-01");
      const staff = Staff.create({
        campusId: validCampusId,
        staffCode: validStaffCode,
        fullName: "Jane Smith",
        email: validEmail,
        phoneNumber: validPhoneNumber,
        staffTypeId: validStaffTypeId,
        address: "123 Main Street",
        dateOfBirth: dateOfBirth,
        gender: Gender.FEMALE,
        startDate: startDate,
        userId: "user-123",
        isArchived: true,
      });

      expect(staff.fullName).toBe("Jane Smith");
      expect(staff.email).toBe(validEmail);
      expect(staff.staffTypeId).toBe(validStaffTypeId);
      expect(staff.address).toBe("123 Main Street");
      expect(staff.dateOfBirth).toEqual(dateOfBirth);
      expect(staff.gender).toBe(Gender.FEMALE);
      expect(staff.startDate).toEqual(startDate);
      expect(staff.userId).toBe("user-123");
      expect(staff.isArchived).toBe(true);
    });

    it("should create a staff with provided id", () => {
      const id = "staff-123";
      const staff = Staff.create(
        {
          campusId: validCampusId,
          staffCode: validStaffCode,
          fullName: "Test Staff",
          email: validEmail,
          phoneNumber: validPhoneNumber,
          address: null,
          dateOfBirth: null,
          gender: null,
          startDate: null,
        },
        id,
      );

      expect(staff.id).toBe(id);
    });

    it("should throw error for missing campusId", () => {
      expect(() =>
        Staff.create({
          campusId: "",
          staffCode: validStaffCode,
          fullName: "Test Staff",
          email: validEmail,
          phoneNumber: validPhoneNumber,
          address: null,
          dateOfBirth: null,
          gender: null,
          startDate: null,
        }),
      ).toThrow("Campus ID is required for staff.");
    });

    it("should throw error for empty fullName", () => {
      expect(() =>
        Staff.create({
          campusId: validCampusId,
          staffCode: validStaffCode,
          fullName: "",
          email: validEmail,
          phoneNumber: validPhoneNumber,
          address: null,
          dateOfBirth: null,
          gender: null,
          startDate: null,
        }),
      ).toThrow("Full name is required and must be at least 2 characters.");
    });

    it("should throw error for fullName less than 2 characters", () => {
      expect(() =>
        Staff.create({
          campusId: validCampusId,
          staffCode: validStaffCode,
          fullName: "A",
          email: validEmail,
          phoneNumber: validPhoneNumber,
          address: null,
          dateOfBirth: null,
          gender: null,
          startDate: null,
        }),
      ).toThrow("Full name is required and must be at least 2 characters.");
    });

    it("should throw error for missing email", () => {
      expect(() =>
        Staff.create({
          campusId: validCampusId,
          staffCode: validStaffCode,
          fullName: "Test Staff",
          email: "",
          phoneNumber: validPhoneNumber,
          address: null,
          dateOfBirth: null,
          gender: null,
          startDate: null,
        }),
      ).toThrow("A valid email address is required.");
    });

    it("should throw error for invalid email format", () => {
      expect(() =>
        Staff.create({
          campusId: validCampusId,
          staffCode: validStaffCode,
          fullName: "Test Staff",
          email: "invalid-email",
          phoneNumber: validPhoneNumber,
          address: null,
          dateOfBirth: null,
          gender: null,
          startDate: null,
        }),
      ).toThrow("A valid email address is required.");
    });

    it("should throw error for missing phoneNumber", () => {
      expect(() =>
        Staff.create({
          campusId: validCampusId,
          staffCode: validStaffCode,
          fullName: "Test Staff",
          email: validEmail,
          phoneNumber: "",
          address: null,
          dateOfBirth: null,
          gender: null,
          startDate: null,
        }),
      ).toThrow(
        "A valid phone number in E.164 format is required (e.g., +84912345678).",
      );
    });

    it("should throw error for invalid phoneNumber format", () => {
      expect(() =>
        Staff.create({
          campusId: validCampusId,
          staffCode: validStaffCode,
          fullName: "Test Staff",
          email: validEmail,
          phoneNumber: "0901234567",
          address: null,
          dateOfBirth: null,
          gender: null,
          startDate: null,
        }),
      ).toThrow(
        "A valid phone number in E.164 format is required (e.g., +84912345678).",
      );
    });

    it("should accept valid E.164 phone numbers", () => {
      const validNumbers = ["+1234567890", "+84901234567", "+12025551234"];

      validNumbers.forEach((phone) => {
        const staff = Staff.create({
          campusId: validCampusId,
          staffCode: validStaffCode,
          fullName: "Test Staff",
          email: validEmail,
          phoneNumber: phone,
          address: null,
          dateOfBirth: null,
          gender: null,
          startDate: null,
        });
        expect(staff.phoneNumber).toBe(phone);
      });
    });

    it("should accept valid email addresses", () => {
      const validEmails = [
        "test@example.com",
        "user.name@domain.org",
        "name+tag@company.io",
      ];

      validEmails.forEach((email) => {
        const staff = Staff.create({
          campusId: validCampusId,
          staffCode: validStaffCode,
          fullName: "Test Staff",
          email: email,
          phoneNumber: validPhoneNumber,
          address: null,
          dateOfBirth: null,
          gender: null,
          startDate: null,
        });
        expect(staff.email).toBe(email);
      });
    });

    it("should throw error for missing staffCode", () => {
      expect(() =>
        Staff.create({
          campusId: validCampusId,
          staffCode: "",
          fullName: "Test Staff",
          email: validEmail,
          phoneNumber: validPhoneNumber,
          address: null,
          dateOfBirth: null,
          gender: null,
          startDate: null,
        }),
      ).toThrow(
        "A valid staff code in format ST-YYYY-XXXXXX is required (e.g., ST-2025-000001).",
      );
    });

    it("should throw error for invalid staffCode format", () => {
      const invalidCodes = [
        "ST-2025-00001",
        "ST-25-000001",
        "STU-2025-000001",
        "ST_2025_000001",
        "2025-000001",
      ];

      invalidCodes.forEach((code) => {
        expect(() =>
          Staff.create({
            campusId: validCampusId,
            staffCode: code,
            fullName: "Test Staff",
            email: validEmail,
            phoneNumber: validPhoneNumber,
            address: null,
            dateOfBirth: null,
            gender: null,
            startDate: null,
          }),
        ).toThrow(
          "A valid staff code in format ST-YYYY-XXXXXX is required (e.g., ST-2025-000001).",
        );
      });
    });

    it("should accept valid staff codes", () => {
      const validCodes = ["ST-2025-000001", "ST-1999-123456", "ST-2099-999999"];

      validCodes.forEach((code) => {
        const staff = Staff.create({
          campusId: validCampusId,
          staffCode: code,
          fullName: "Test Staff",
          email: validEmail,
          phoneNumber: validPhoneNumber,
          address: null,
          dateOfBirth: null,
          gender: null,
          startDate: null,
        });
        expect(staff.staffCode).toBe(code);
      });
    });
  });

  describe("updateProfile", () => {
    let staff: Staff;

    beforeEach(() => {
      staff = Staff.create({
        campusId: validCampusId,
        staffCode: validStaffCode,
        fullName: "Original Name",
        email: validEmail,
        phoneNumber: validPhoneNumber,
        staffTypeId: validStaffTypeId,
        address: "Original Address",
        dateOfBirth: new Date("1990-01-01"),
        gender: Gender.MALE,
        startDate: new Date("2023-01-01"),
      });
    });

    it("should update fullName", () => {
      staff.updateProfile({ fullName: "Updated Name" });

      expect(staff.fullName).toBe("Updated Name");
    });

    it("should update email", () => {
      staff.updateProfile({ email: "newemail@example.com" });

      expect(staff.email).toBe("newemail@example.com");
    });

    it("should update phoneNumber", () => {
      staff.updateProfile({ phoneNumber: "+84987654321" });

      expect(staff.phoneNumber).toBe("+84987654321");
    });

    it("should update staffTypeId", () => {
      const newStaffTypeId = "789e0123-e89b-12d3-a456-426614174000";
      staff.updateProfile({ staffTypeId: newStaffTypeId });

      expect(staff.staffTypeId).toBe(newStaffTypeId);
    });

    it("should set staffTypeId to null", () => {
      staff.updateProfile({ staffTypeId: null });

      expect(staff.staffTypeId).toBeNull();
    });

    it("should update address", () => {
      staff.updateProfile({ address: "New Address" });

      expect(staff.address).toBe("New Address");
    });

    it("should set address to null", () => {
      staff.updateProfile({ address: null });

      expect(staff.address).toBeNull();
    });

    it("should update dateOfBirth", () => {
      const newDate = new Date("1985-05-15");
      staff.updateProfile({ dateOfBirth: newDate });

      expect(staff.dateOfBirth).toEqual(newDate);
    });

    it("should set dateOfBirth to null", () => {
      staff.updateProfile({ dateOfBirth: null });

      expect(staff.dateOfBirth).toBeNull();
    });

    it("should update gender", () => {
      staff.updateProfile({ gender: Gender.FEMALE });

      expect(staff.gender).toBe(Gender.FEMALE);
    });

    it("should set gender to null", () => {
      staff.updateProfile({ gender: null });

      expect(staff.gender).toBeNull();
    });

    it("should update startDate", () => {
      const newDate = new Date("2024-06-01");
      staff.updateProfile({ startDate: newDate });

      expect(staff.startDate).toEqual(newDate);
    });

    it("should set startDate to null", () => {
      staff.updateProfile({ startDate: null });

      expect(staff.startDate).toBeNull();
    });

    it("should update userId", () => {
      staff.updateProfile({ userId: "new-user-id" });

      expect(staff.userId).toBe("new-user-id");
    });

    it("should set userId to null", () => {
      const staffWithUser = Staff.create({
        campusId: validCampusId,
        staffCode: validStaffCode,
        fullName: "Test",
        email: validEmail,
        phoneNumber: validPhoneNumber,
        address: null,
        dateOfBirth: null,
        gender: null,
        startDate: null,
        userId: "existing-user",
      });

      staffWithUser.updateProfile({ userId: null });

      expect(staffWithUser.userId).toBeNull();
    });

    it("should update multiple fields at once", () => {
      staff.updateProfile({
        fullName: "New Name",
        address: "New Address",
        gender: Gender.OTHER,
      });

      expect(staff.fullName).toBe("New Name");
      expect(staff.address).toBe("New Address");
      expect(staff.gender).toBe(Gender.OTHER);
    });

    it("should update updatedAt timestamp", () => {
      const originalUpdatedAt = staff.updatedAt;

      jest.useFakeTimers();
      jest.advanceTimersByTime(1000);

      staff.updateProfile({ fullName: "New Name" });

      expect(staff.updatedAt.getTime()).toBeGreaterThan(
        originalUpdatedAt.getTime(),
      );

      jest.useRealTimers();
    });

    it("should not change campusId (immutable)", () => {
      const originalCampusId = staff.campusId;

      // campusId is not part of UpdateStaffData, so this shouldn't compile
      // But we test that the entity preserves campusId through updates
      staff.updateProfile({ fullName: "New Name" });

      expect(staff.campusId).toBe(originalCampusId);
    });
  });

  describe("changeStaffType", () => {
    it("should change staff type", () => {
      const staff = Staff.create({
        campusId: validCampusId,
        staffCode: validStaffCode,
        fullName: "Test Staff",
        email: validEmail,
        phoneNumber: validPhoneNumber,
        staffTypeId: null,
        address: null,
        dateOfBirth: null,
        gender: null,
        startDate: null,
      });

      staff.changeStaffType(validStaffTypeId);

      expect(staff.staffTypeId).toBe(validStaffTypeId);
    });

    it("should clear staff type when set to null", () => {
      const staff = Staff.create({
        campusId: validCampusId,
        staffCode: validStaffCode,
        fullName: "Test Staff",
        email: validEmail,
        phoneNumber: validPhoneNumber,
        staffTypeId: validStaffTypeId,
        address: null,
        dateOfBirth: null,
        gender: null,
        startDate: null,
      });

      staff.changeStaffType(null);

      expect(staff.staffTypeId).toBeNull();
    });

    it("should update updatedAt timestamp", () => {
      const staff = Staff.create({
        campusId: validCampusId,
        staffCode: validStaffCode,
        fullName: "Test Staff",
        email: validEmail,
        phoneNumber: validPhoneNumber,
        address: null,
        dateOfBirth: null,
        gender: null,
        startDate: null,
      });
      const originalUpdatedAt = staff.updatedAt;

      jest.useFakeTimers();
      jest.advanceTimersByTime(1000);

      staff.changeStaffType(validStaffTypeId);

      expect(staff.updatedAt.getTime()).toBeGreaterThan(
        originalUpdatedAt.getTime(),
      );

      jest.useRealTimers();
    });
  });

  describe("hasStaffType", () => {
    it("should return true when staffTypeId is set", () => {
      const staff = Staff.create({
        campusId: validCampusId,
        staffCode: validStaffCode,
        fullName: "Test Staff",
        email: validEmail,
        phoneNumber: validPhoneNumber,
        staffTypeId: validStaffTypeId,
        address: null,
        dateOfBirth: null,
        gender: null,
        startDate: null,
      });

      expect(staff.hasStaffType()).toBe(true);
    });

    it("should return false when staffTypeId is null", () => {
      const staff = Staff.create({
        campusId: validCampusId,
        staffCode: validStaffCode,
        fullName: "Test Staff",
        email: validEmail,
        phoneNumber: validPhoneNumber,
        address: null,
        dateOfBirth: null,
        gender: null,
        startDate: null,
      });

      expect(staff.hasStaffType()).toBe(false);
    });
  });

  describe("linkUser", () => {
    it("should link a user to staff", () => {
      const staff = Staff.create({
        campusId: validCampusId,
        staffCode: validStaffCode,
        fullName: "Test Staff",
        email: validEmail,
        phoneNumber: validPhoneNumber,
        address: null,
        dateOfBirth: null,
        gender: null,
        startDate: null,
      });

      staff.linkUser("user-123");

      expect(staff.userId).toBe("user-123");
    });

    it("should update updatedAt timestamp", () => {
      const staff = Staff.create({
        campusId: validCampusId,
        staffCode: validStaffCode,
        fullName: "Test Staff",
        email: validEmail,
        phoneNumber: validPhoneNumber,
        address: null,
        dateOfBirth: null,
        gender: null,
        startDate: null,
      });
      const originalUpdatedAt = staff.updatedAt;

      jest.useFakeTimers();
      jest.advanceTimersByTime(1000);

      staff.linkUser("user-123");

      expect(staff.updatedAt.getTime()).toBeGreaterThan(
        originalUpdatedAt.getTime(),
      );

      jest.useRealTimers();
    });
  });

  describe("unlinkUser", () => {
    it("should unlink user from staff", () => {
      const staff = Staff.create({
        campusId: validCampusId,
        staffCode: validStaffCode,
        fullName: "Test Staff",
        email: validEmail,
        phoneNumber: validPhoneNumber,
        address: null,
        dateOfBirth: null,
        gender: null,
        startDate: null,
        userId: "user-123",
      });

      staff.unlinkUser();

      expect(staff.userId).toBeNull();
    });

    it("should update updatedAt timestamp", () => {
      const staff = Staff.create({
        campusId: validCampusId,
        staffCode: validStaffCode,
        fullName: "Test Staff",
        email: validEmail,
        phoneNumber: validPhoneNumber,
        address: null,
        dateOfBirth: null,
        gender: null,
        startDate: null,
        userId: "user-123",
      });
      const originalUpdatedAt = staff.updatedAt;

      jest.useFakeTimers();
      jest.advanceTimersByTime(1000);

      staff.unlinkUser();

      expect(staff.updatedAt.getTime()).toBeGreaterThan(
        originalUpdatedAt.getTime(),
      );

      jest.useRealTimers();
    });
  });

  describe("hasUserAccount", () => {
    it("should return true when userId is set", () => {
      const staff = Staff.create({
        campusId: validCampusId,
        staffCode: validStaffCode,
        fullName: "Test Staff",
        email: validEmail,
        phoneNumber: validPhoneNumber,
        address: null,
        dateOfBirth: null,
        gender: null,
        startDate: null,
        userId: "user-123",
      });

      expect(staff.hasUserAccount()).toBe(true);
    });

    it("should return false when userId is null", () => {
      const staff = Staff.create({
        campusId: validCampusId,
        staffCode: validStaffCode,
        fullName: "Test Staff",
        email: validEmail,
        phoneNumber: validPhoneNumber,
        address: null,
        dateOfBirth: null,
        gender: null,
        startDate: null,
      });

      expect(staff.hasUserAccount()).toBe(false);
    });
  });

  describe("archive", () => {
    it("should set isArchived to true", () => {
      const staff = Staff.create({
        campusId: validCampusId,
        staffCode: validStaffCode,
        fullName: "Test Staff",
        email: validEmail,
        phoneNumber: validPhoneNumber,
        address: null,
        dateOfBirth: null,
        gender: null,
        startDate: null,
        isArchived: false,
      });

      staff.archive();

      expect(staff.isArchived).toBe(true);
    });

    it("should update updatedAt timestamp", () => {
      const staff = Staff.create({
        campusId: validCampusId,
        staffCode: validStaffCode,
        fullName: "Test Staff",
        email: validEmail,
        phoneNumber: validPhoneNumber,
        address: null,
        dateOfBirth: null,
        gender: null,
        startDate: null,
      });
      const originalUpdatedAt = staff.updatedAt;

      jest.useFakeTimers();
      jest.advanceTimersByTime(1000);

      staff.archive();

      expect(staff.updatedAt.getTime()).toBeGreaterThan(
        originalUpdatedAt.getTime(),
      );

      jest.useRealTimers();
    });
  });

  describe("restore", () => {
    it("should set isArchived to false", () => {
      const staff = Staff.create({
        campusId: validCampusId,
        staffCode: validStaffCode,
        fullName: "Test Staff",
        email: validEmail,
        phoneNumber: validPhoneNumber,
        address: null,
        dateOfBirth: null,
        gender: null,
        startDate: null,
        isArchived: true,
      });

      staff.restore();

      expect(staff.isArchived).toBe(false);
    });

    it("should update updatedAt timestamp", () => {
      const staff = Staff.create({
        campusId: validCampusId,
        staffCode: validStaffCode,
        fullName: "Test Staff",
        email: validEmail,
        phoneNumber: validPhoneNumber,
        address: null,
        dateOfBirth: null,
        gender: null,
        startDate: null,
        isArchived: true,
      });
      const originalUpdatedAt = staff.updatedAt;

      jest.useFakeTimers();
      jest.advanceTimersByTime(1000);

      staff.restore();

      expect(staff.updatedAt.getTime()).toBeGreaterThan(
        originalUpdatedAt.getTime(),
      );

      jest.useRealTimers();
    });
  });
});
