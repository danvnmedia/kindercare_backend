import { Guardian } from "./guardian.entity";
import { Gender } from "../enums/gender.enum";

describe("Guardian Entity", () => {
  const validCampusId = "123e4567-e89b-12d3-a456-426614174000";
  const validPhoneNumber = "+84901234567";
  const validEmail = "test@example.com";

  describe("create", () => {
    it("should create a guardian with required fields", () => {
      const guardian = Guardian.create({
        campusId: validCampusId,
        fullName: "John Doe",
        phoneNumber: validPhoneNumber,
        email: null,
        address: null,
        dateOfBirth: null,
        gender: null,
        occupation: null,
        workAddress: null,
      });

      expect(guardian.campusId).toBe(validCampusId);
      expect(guardian.fullName).toBe("John Doe");
      expect(guardian.phoneNumber).toBe(validPhoneNumber);
      expect(guardian.email).toBeNull();
      expect(guardian.address).toBeNull();
      expect(guardian.dateOfBirth).toBeNull();
      expect(guardian.gender).toBeNull();
      expect(guardian.occupation).toBeNull();
      expect(guardian.workAddress).toBeNull();
      expect(guardian.userId).toBeNull();
      expect(guardian.isArchived).toBe(false);
      expect(guardian.id).toBeDefined();
      expect(guardian.createdAt).toBeInstanceOf(Date);
      expect(guardian.updatedAt).toBeInstanceOf(Date);
    });

    it("should create a guardian with all fields", () => {
      const dateOfBirth = new Date("1985-03-15");
      const guardian = Guardian.create({
        campusId: validCampusId,
        fullName: "Jane Smith",
        email: validEmail,
        phoneNumber: validPhoneNumber,
        address: "123 Main Street",
        dateOfBirth: dateOfBirth,
        gender: Gender.FEMALE,
        occupation: "Teacher",
        workAddress: "456 School Road",
        userId: "user-123",
        isArchived: true,
      });

      expect(guardian.fullName).toBe("Jane Smith");
      expect(guardian.email).toBe(validEmail);
      expect(guardian.address).toBe("123 Main Street");
      expect(guardian.dateOfBirth).toEqual(dateOfBirth);
      expect(guardian.gender).toBe(Gender.FEMALE);
      expect(guardian.occupation).toBe("Teacher");
      expect(guardian.workAddress).toBe("456 School Road");
      expect(guardian.userId).toBe("user-123");
      expect(guardian.isArchived).toBe(true);
    });

    it("should create a guardian with provided id", () => {
      const id = "guardian-123";
      const guardian = Guardian.create(
        {
          campusId: validCampusId,
          fullName: "Test Guardian",
          phoneNumber: validPhoneNumber,
          email: null,
          address: null,
          dateOfBirth: null,
          gender: null,
          occupation: null,
          workAddress: null,
        },
        id,
      );

      expect(guardian.id).toBe(id);
    });

    it("should throw error for missing campusId", () => {
      expect(() =>
        Guardian.create({
          campusId: "",
          fullName: "Test Guardian",
          phoneNumber: validPhoneNumber,
          email: null,
          address: null,
          dateOfBirth: null,
          gender: null,
          occupation: null,
          workAddress: null,
        }),
      ).toThrow("Campus ID is required for guardian.");
    });

    it("should throw error for empty fullName", () => {
      expect(() =>
        Guardian.create({
          campusId: validCampusId,
          fullName: "",
          phoneNumber: validPhoneNumber,
          email: null,
          address: null,
          dateOfBirth: null,
          gender: null,
          occupation: null,
          workAddress: null,
        }),
      ).toThrow("Full name is required and must be at least 2 characters.");
    });

    it("should throw error for fullName less than 2 characters", () => {
      expect(() =>
        Guardian.create({
          campusId: validCampusId,
          fullName: "A",
          phoneNumber: validPhoneNumber,
          email: null,
          address: null,
          dateOfBirth: null,
          gender: null,
          occupation: null,
          workAddress: null,
        }),
      ).toThrow("Full name is required and must be at least 2 characters.");
    });

    it("should throw error for invalid email format", () => {
      expect(() =>
        Guardian.create({
          campusId: validCampusId,
          fullName: "Test Guardian",
          phoneNumber: validPhoneNumber,
          email: "invalid-email",
          address: null,
          dateOfBirth: null,
          gender: null,
          occupation: null,
          workAddress: null,
        }),
      ).toThrow("Email must be a valid email address.");
    });

    it("should allow null email", () => {
      const guardian = Guardian.create({
        campusId: validCampusId,
        fullName: "Test Guardian",
        phoneNumber: validPhoneNumber,
        email: null,
        address: null,
        dateOfBirth: null,
        gender: null,
        occupation: null,
        workAddress: null,
      });

      expect(guardian.email).toBeNull();
    });

    it("should throw error for missing phoneNumber", () => {
      expect(() =>
        Guardian.create({
          campusId: validCampusId,
          fullName: "Test Guardian",
          phoneNumber: "",
          email: null,
          address: null,
          dateOfBirth: null,
          gender: null,
          occupation: null,
          workAddress: null,
        }),
      ).toThrow(
        "Phone number is required and must be in E.164 format (e.g., +84912345678).",
      );
    });

    it("should throw error for invalid phoneNumber format", () => {
      expect(() =>
        Guardian.create({
          campusId: validCampusId,
          fullName: "Test Guardian",
          phoneNumber: "0901234567",
          email: null,
          address: null,
          dateOfBirth: null,
          gender: null,
          occupation: null,
          workAddress: null,
        }),
      ).toThrow(
        "Phone number is required and must be in E.164 format (e.g., +84912345678).",
      );
    });

    it("should accept valid E.164 phone numbers", () => {
      const validNumbers = ["+1234567890", "+84901234567", "+12025551234"];

      validNumbers.forEach((phone) => {
        const guardian = Guardian.create({
          campusId: validCampusId,
          fullName: "Test Guardian",
          phoneNumber: phone,
          email: null,
          address: null,
          dateOfBirth: null,
          gender: null,
          occupation: null,
          workAddress: null,
        });
        expect(guardian.phoneNumber).toBe(phone);
      });
    });

    it("should throw error for invalid gender", () => {
      expect(() =>
        Guardian.create({
          campusId: validCampusId,
          fullName: "Test Guardian",
          phoneNumber: validPhoneNumber,
          email: null,
          address: null,
          dateOfBirth: null,
          gender: "INVALID" as Gender,
          occupation: null,
          workAddress: null,
        }),
      ).toThrow("Gender must be MALE, FEMALE, or OTHER.");
    });

    it("should accept valid gender values", () => {
      const validGenders = [Gender.MALE, Gender.FEMALE, Gender.OTHER];

      validGenders.forEach((gender) => {
        const guardian = Guardian.create({
          campusId: validCampusId,
          fullName: "Test Guardian",
          phoneNumber: validPhoneNumber,
          email: null,
          address: null,
          dateOfBirth: null,
          gender: gender,
          occupation: null,
          workAddress: null,
        });
        expect(guardian.gender).toBe(gender);
      });
    });

    it("should allow null gender", () => {
      const guardian = Guardian.create({
        campusId: validCampusId,
        fullName: "Test Guardian",
        phoneNumber: validPhoneNumber,
        email: null,
        address: null,
        dateOfBirth: null,
        gender: null,
        occupation: null,
        workAddress: null,
      });

      expect(guardian.gender).toBeNull();
    });
  });

  describe("updateProfile", () => {
    let guardian: Guardian;

    beforeEach(() => {
      guardian = Guardian.create({
        campusId: validCampusId,
        fullName: "Original Name",
        email: validEmail,
        phoneNumber: validPhoneNumber,
        address: "Original Address",
        dateOfBirth: new Date("1990-01-01"),
        gender: Gender.MALE,
        occupation: "Original Occupation",
        workAddress: "Original Work Address",
      });
    });

    it("should update fullName", () => {
      guardian.updateProfile({ fullName: "Updated Name" });

      expect(guardian.fullName).toBe("Updated Name");
    });

    it("should update email", () => {
      guardian.updateProfile({ email: "new@example.com" });

      expect(guardian.email).toBe("new@example.com");
    });

    it("should set email to null", () => {
      guardian.updateProfile({ email: null });

      expect(guardian.email).toBeNull();
    });

    it("should update phoneNumber", () => {
      guardian.updateProfile({ phoneNumber: "+12025551234" });

      expect(guardian.phoneNumber).toBe("+12025551234");
    });

    it("should update address", () => {
      guardian.updateProfile({ address: "New Address" });

      expect(guardian.address).toBe("New Address");
    });

    it("should set address to null", () => {
      guardian.updateProfile({ address: null });

      expect(guardian.address).toBeNull();
    });

    it("should update dateOfBirth", () => {
      const newDate = new Date("1985-05-15");
      guardian.updateProfile({ dateOfBirth: newDate });

      expect(guardian.dateOfBirth).toEqual(newDate);
    });

    it("should set dateOfBirth to null", () => {
      guardian.updateProfile({ dateOfBirth: null });

      expect(guardian.dateOfBirth).toBeNull();
    });

    it("should update gender", () => {
      guardian.updateProfile({ gender: Gender.FEMALE });

      expect(guardian.gender).toBe(Gender.FEMALE);
    });

    it("should set gender to null", () => {
      guardian.updateProfile({ gender: null });

      expect(guardian.gender).toBeNull();
    });

    it("should update occupation", () => {
      guardian.updateProfile({ occupation: "New Occupation" });

      expect(guardian.occupation).toBe("New Occupation");
    });

    it("should set occupation to null", () => {
      guardian.updateProfile({ occupation: null });

      expect(guardian.occupation).toBeNull();
    });

    it("should update workAddress", () => {
      guardian.updateProfile({ workAddress: "New Work Address" });

      expect(guardian.workAddress).toBe("New Work Address");
    });

    it("should set workAddress to null", () => {
      guardian.updateProfile({ workAddress: null });

      expect(guardian.workAddress).toBeNull();
    });

    it("should update userId", () => {
      guardian.updateProfile({ userId: "new-user-id" });

      expect(guardian.userId).toBe("new-user-id");
    });

    it("should set userId to null", () => {
      const guardianWithUser = Guardian.create({
        campusId: validCampusId,
        fullName: "Test",
        phoneNumber: validPhoneNumber,
        email: null,
        address: null,
        dateOfBirth: null,
        gender: null,
        occupation: null,
        workAddress: null,
        userId: "existing-user",
      });

      guardianWithUser.updateProfile({ userId: null });

      expect(guardianWithUser.userId).toBeNull();
    });

    it("should update multiple fields at once", () => {
      guardian.updateProfile({
        fullName: "New Name",
        email: "new@example.com",
        address: "New Address",
        gender: Gender.OTHER,
      });

      expect(guardian.fullName).toBe("New Name");
      expect(guardian.email).toBe("new@example.com");
      expect(guardian.address).toBe("New Address");
      expect(guardian.gender).toBe(Gender.OTHER);
    });

    it("should update updatedAt timestamp", () => {
      const originalUpdatedAt = guardian.updatedAt;

      jest.useFakeTimers();
      jest.advanceTimersByTime(1000);

      guardian.updateProfile({ fullName: "New Name" });

      expect(guardian.updatedAt.getTime()).toBeGreaterThan(
        originalUpdatedAt.getTime(),
      );

      jest.useRealTimers();
    });

    it("should not change campusId (immutable)", () => {
      const originalCampusId = guardian.campusId;

      // campusId is not part of UpdateGuardianData, so this shouldn't compile
      // But we test that the entity preserves campusId through updates
      guardian.updateProfile({ fullName: "New Name" });

      expect(guardian.campusId).toBe(originalCampusId);
    });
  });

  describe("archive", () => {
    it("should set isArchived to true", () => {
      const guardian = Guardian.create({
        campusId: validCampusId,
        fullName: "Test Guardian",
        phoneNumber: validPhoneNumber,
        email: null,
        address: null,
        dateOfBirth: null,
        gender: null,
        occupation: null,
        workAddress: null,
        isArchived: false,
      });

      guardian.archive();

      expect(guardian.isArchived).toBe(true);
    });

    it("should update updatedAt timestamp", () => {
      const guardian = Guardian.create({
        campusId: validCampusId,
        fullName: "Test Guardian",
        phoneNumber: validPhoneNumber,
        email: null,
        address: null,
        dateOfBirth: null,
        gender: null,
        occupation: null,
        workAddress: null,
      });
      const originalUpdatedAt = guardian.updatedAt;

      jest.useFakeTimers();
      jest.advanceTimersByTime(1000);

      guardian.archive();

      expect(guardian.updatedAt.getTime()).toBeGreaterThan(
        originalUpdatedAt.getTime(),
      );

      jest.useRealTimers();
    });
  });

  describe("restore", () => {
    it("should set isArchived to false", () => {
      const guardian = Guardian.create({
        campusId: validCampusId,
        fullName: "Test Guardian",
        phoneNumber: validPhoneNumber,
        email: null,
        address: null,
        dateOfBirth: null,
        gender: null,
        occupation: null,
        workAddress: null,
        isArchived: true,
      });

      guardian.restore();

      expect(guardian.isArchived).toBe(false);
    });

    it("should update updatedAt timestamp", () => {
      const guardian = Guardian.create({
        campusId: validCampusId,
        fullName: "Test Guardian",
        phoneNumber: validPhoneNumber,
        email: null,
        address: null,
        dateOfBirth: null,
        gender: null,
        occupation: null,
        workAddress: null,
        isArchived: true,
      });
      const originalUpdatedAt = guardian.updatedAt;

      jest.useFakeTimers();
      jest.advanceTimersByTime(1000);

      guardian.restore();

      expect(guardian.updatedAt.getTime()).toBeGreaterThan(
        originalUpdatedAt.getTime(),
      );

      jest.useRealTimers();
    });
  });

  describe("hasUserAccount", () => {
    it("should return true when userId is set", () => {
      const guardian = Guardian.create({
        campusId: validCampusId,
        fullName: "Test Guardian",
        phoneNumber: validPhoneNumber,
        email: null,
        address: null,
        dateOfBirth: null,
        gender: null,
        occupation: null,
        workAddress: null,
        userId: "user-123",
      });

      expect(guardian.hasUserAccount()).toBe(true);
    });

    it("should return false when userId is null", () => {
      const guardian = Guardian.create({
        campusId: validCampusId,
        fullName: "Test Guardian",
        phoneNumber: validPhoneNumber,
        email: null,
        address: null,
        dateOfBirth: null,
        gender: null,
        occupation: null,
        workAddress: null,
      });

      expect(guardian.hasUserAccount()).toBe(false);
    });
  });

  describe("getGuardianType (static)", () => {
    it("should return 'Father' for FATHER", () => {
      expect(Guardian.getGuardianType("FATHER")).toBe("Father");
    });

    it("should return 'Mother' for MOTHER", () => {
      expect(Guardian.getGuardianType("MOTHER")).toBe("Mother");
    });

    it("should return 'Guardian' for GUARDIAN", () => {
      expect(Guardian.getGuardianType("GUARDIAN")).toBe("Guardian");
    });

    it("should return 'Guardian' for unknown relationship", () => {
      expect(Guardian.getGuardianType("UNKNOWN")).toBe("Guardian");
    });
  });

  describe("validateRelationshipId (static)", () => {
    it("should return true for FATHER", () => {
      expect(Guardian.validateRelationshipId("FATHER")).toBe(true);
    });

    it("should return true for MOTHER", () => {
      expect(Guardian.validateRelationshipId("MOTHER")).toBe(true);
    });

    it("should return true for GUARDIAN", () => {
      expect(Guardian.validateRelationshipId("GUARDIAN")).toBe(true);
    });

    it("should return false for invalid relationship", () => {
      expect(Guardian.validateRelationshipId("INVALID")).toBe(false);
      expect(Guardian.validateRelationshipId("UNCLE")).toBe(false);
      expect(Guardian.validateRelationshipId("")).toBe(false);
    });
  });
});
