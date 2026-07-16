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
      expect(campus.timeZone).toBe("Asia/Ho_Chi_Minh");
      expect(campus.isArchived).toBe(false);
      expect(campus.id).toBeDefined();
      expect(campus.createdAt).toBeInstanceOf(Date);
      expect(campus.updatedAt).toBeInstanceOf(Date);
    });

    it("should create a campus with all fields", () => {
      const campus = Campus.create({
        name: "Branch Campus",
        address: "123 Main Street",
        phoneNumber: "+84901234567",
        timeZone: "America/Toronto",
        isArchived: true,
      });

      expect(campus.name).toBe("Branch Campus");
      expect(campus.address).toBe("123 Main Street");
      expect(campus.phoneNumber).toBe("+84901234567");
      expect(campus.timeZone).toBe("America/Toronto");
      expect(campus.isArchived).toBe(true);
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

    it("should reject an invalid IANA timezone", () => {
      expect(() =>
        Campus.create({ name: "Test", timeZone: "Mars/Olympus" }),
      ).toThrow("Campus timeZone must be a valid IANA timezone");
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

    it("should update the IANA timezone", () => {
      campus.update({ timeZone: "America/Toronto" });

      expect(campus.timeZone).toBe("America/Toronto");
    });

    it("should reject an invalid timezone update", () => {
      expect(() => campus.update({ timeZone: "Invalid/Zone" })).toThrow(
        "Campus timeZone must be a valid IANA timezone",
      );
    });

    it("should update isArchived", () => {
      campus.update({ isArchived: true });

      expect(campus.isArchived).toBe(true);
    });

    it("should update multiple fields at once", () => {
      campus.update({
        name: "New Name",
        address: "New Address",
        isArchived: true,
      });

      expect(campus.name).toBe("New Name");
      expect(campus.address).toBe("New Address");
      expect(campus.isArchived).toBe(true);
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

  describe("archive", () => {
    it("should set isArchived to true", () => {
      const campus = Campus.create({ name: "Test", isArchived: false });

      campus.archive();

      expect(campus.isArchived).toBe(true);
    });

    it("should not change if already archived", () => {
      const campus = Campus.create({ name: "Test", isArchived: true });
      const originalUpdatedAt = campus.updatedAt;

      campus.archive();

      expect(campus.isArchived).toBe(true);
      expect(campus.updatedAt).toEqual(originalUpdatedAt);
    });
  });

  describe("unarchive", () => {
    it("should set isArchived to false", () => {
      const campus = Campus.create({ name: "Test", isArchived: true });

      campus.unarchive();

      expect(campus.isArchived).toBe(false);
    });

    it("should not change if already not archived", () => {
      const campus = Campus.create({ name: "Test", isArchived: false });
      const originalUpdatedAt = campus.updatedAt;

      campus.unarchive();

      expect(campus.isArchived).toBe(false);
      expect(campus.updatedAt).toEqual(originalUpdatedAt);
    });
  });
});
