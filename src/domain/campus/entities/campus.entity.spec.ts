import { Campus } from "./campus.entity";

describe("Campus Entity", () => {
  describe("create", () => {
    it("should create a campus with required fields", () => {
      const campus = Campus.create({
        name: "Main Campus",
      });

      expect(campus.name).toBe("Main Campus");
      expect(campus.address).toBeNull();
      expect(campus.phoneNumber).toBeNull();
      expect(campus.isActive).toBe(true);
      expect(campus.id).toBeDefined();
      expect(campus.createdAt).toBeInstanceOf(Date);
      expect(campus.updatedAt).toBeInstanceOf(Date);
    });

    it("should create a campus with all fields", () => {
      const campus = Campus.create({
        name: "Branch Campus",
        address: "123 Main Street",
        phoneNumber: "+84901234567",
        isActive: false,
      });

      expect(campus.name).toBe("Branch Campus");
      expect(campus.address).toBe("123 Main Street");
      expect(campus.phoneNumber).toBe("+84901234567");
      expect(campus.isActive).toBe(false);
    });

    it("should create a campus with provided id", () => {
      const id = "123e4567-e89b-12d3-a456-426614174000";
      const campus = Campus.create({ name: "Test Campus" }, id);

      expect(campus.id).toBe(id);
    });

    it("should trim name and address", () => {
      const campus = Campus.create({
        name: "  Main Campus  ",
        address: "  123 Main Street  ",
      });

      expect(campus.name).toBe("Main Campus");
      expect(campus.address).toBe("123 Main Street");
    });

    it("should throw error for empty name", () => {
      expect(() => Campus.create({ name: "" })).toThrow(
        "Campus name is required",
      );
    });

    it("should throw error for whitespace-only name", () => {
      expect(() => Campus.create({ name: "   " })).toThrow(
        "Campus name is required",
      );
    });

    it("should throw error for name exceeding 200 characters", () => {
      const longName = "a".repeat(201);
      expect(() => Campus.create({ name: longName })).toThrow(
        "Campus name must be at most 200 characters",
      );
    });

    it("should throw error for invalid phone number format", () => {
      expect(() =>
        Campus.create({ name: "Test", phoneNumber: "123456" }),
      ).toThrow("Phone number must be in E.164 format");
    });

    it("should accept valid E.164 phone numbers", () => {
      const validNumbers = ["+1234567890", "+84901234567", "+12025551234"];

      validNumbers.forEach((phone) => {
        const campus = Campus.create({ name: "Test", phoneNumber: phone });
        expect(campus.phoneNumber).toBe(phone);
      });
    });
  });

  describe("update", () => {
    let campus: Campus;

    beforeEach(() => {
      campus = Campus.create({
        name: "Original Campus",
        address: "Original Address",
        phoneNumber: "+84901234567",
      });
    });

    it("should update name", () => {
      campus.update({ name: "Updated Campus" });

      expect(campus.name).toBe("Updated Campus");
    });

    it("should update address", () => {
      campus.update({ address: "New Address" });

      expect(campus.address).toBe("New Address");
    });

    it("should set address to null", () => {
      campus.update({ address: null });

      expect(campus.address).toBeNull();
    });

    it("should update phone number", () => {
      campus.update({ phoneNumber: "+12025551234" });

      expect(campus.phoneNumber).toBe("+12025551234");
    });

    it("should set phone number to null", () => {
      campus.update({ phoneNumber: null });

      expect(campus.phoneNumber).toBeNull();
    });

    it("should update isActive", () => {
      campus.update({ isActive: false });

      expect(campus.isActive).toBe(false);
    });

    it("should update multiple fields at once", () => {
      campus.update({
        name: "New Name",
        address: "New Address",
        isActive: false,
      });

      expect(campus.name).toBe("New Name");
      expect(campus.address).toBe("New Address");
      expect(campus.isActive).toBe(false);
    });

    it("should update updatedAt timestamp", () => {
      const originalUpdatedAt = campus.updatedAt;

      // Wait a bit to ensure timestamp difference
      jest.useFakeTimers();
      jest.advanceTimersByTime(1000);

      campus.update({ name: "New Name" });

      expect(campus.updatedAt.getTime()).toBeGreaterThan(
        originalUpdatedAt.getTime(),
      );

      jest.useRealTimers();
    });

    it("should throw error for empty name", () => {
      expect(() => campus.update({ name: "" })).toThrow(
        "Campus name is required",
      );
    });

    it("should throw error for invalid phone number", () => {
      expect(() => campus.update({ phoneNumber: "invalid" })).toThrow(
        "Phone number must be in E.164 format",
      );
    });
  });

  describe("activate", () => {
    it("should set isActive to true", () => {
      const campus = Campus.create({ name: "Test", isActive: false });

      campus.activate();

      expect(campus.isActive).toBe(true);
    });

    it("should not change if already active", () => {
      const campus = Campus.create({ name: "Test", isActive: true });
      const originalUpdatedAt = campus.updatedAt;

      campus.activate();

      expect(campus.isActive).toBe(true);
      expect(campus.updatedAt).toEqual(originalUpdatedAt);
    });
  });

  describe("deactivate", () => {
    it("should set isActive to false", () => {
      const campus = Campus.create({ name: "Test", isActive: true });

      campus.deactivate();

      expect(campus.isActive).toBe(false);
    });

    it("should not change if already inactive", () => {
      const campus = Campus.create({ name: "Test", isActive: false });
      const originalUpdatedAt = campus.updatedAt;

      campus.deactivate();

      expect(campus.isActive).toBe(false);
      expect(campus.updatedAt).toEqual(originalUpdatedAt);
    });
  });
});
