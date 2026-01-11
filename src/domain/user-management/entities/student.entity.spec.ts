import { Student } from "./student.entity";
import { Gender } from "../enums/gender.enum";
import { StudentStatus } from "../enums/student-status.enum";

describe("Student Entity", () => {
  const validCampusId = "123e4567-e89b-12d3-a456-426614174000";
  const validStudentCode = "2025-000001";
  const validEmail = "student@example.com";
  const validPhoneNumber = "+84901234567";

  describe("create", () => {
    it("should create a student with required fields", () => {
      const student = Student.create({
        campusId: validCampusId,
        studentCode: validStudentCode,
        fullName: "John Doe",
        email: null,
        phoneNumber: null,
        address: null,
        dateOfBirth: null,
        nickname: null,
        gender: null,
      });

      expect(student.campusId).toBe(validCampusId);
      expect(student.studentCode).toBe(validStudentCode);
      expect(student.fullName).toBe("John Doe");
      expect(student.email).toBeNull();
      expect(student.phoneNumber).toBeNull();
      expect(student.address).toBeNull();
      expect(student.dateOfBirth).toBeNull();
      expect(student.nickname).toBeNull();
      expect(student.gender).toBeNull();
      expect(student.status).toBe(StudentStatus.ACTIVE);
      expect(student.isArchived).toBe(false);
      expect(student.id).toBeDefined();
      expect(student.createdAt).toBeInstanceOf(Date);
      expect(student.updatedAt).toBeInstanceOf(Date);
    });

    it("should create a student with all fields", () => {
      const dateOfBirth = new Date("2018-05-15");
      const student = Student.create({
        campusId: validCampusId,
        studentCode: validStudentCode,
        fullName: "Jane Doe",
        email: validEmail,
        phoneNumber: validPhoneNumber,
        address: "123 Main Street",
        dateOfBirth: dateOfBirth,
        nickname: "JD",
        gender: Gender.FEMALE,
        status: StudentStatus.WAITING,
        isArchived: false,
      });

      expect(student.campusId).toBe(validCampusId);
      expect(student.studentCode).toBe(validStudentCode);
      expect(student.fullName).toBe("Jane Doe");
      expect(student.email).toBe(validEmail);
      expect(student.phoneNumber).toBe(validPhoneNumber);
      expect(student.address).toBe("123 Main Street");
      expect(student.dateOfBirth).toEqual(dateOfBirth);
      expect(student.nickname).toBe("JD");
      expect(student.gender).toBe(Gender.FEMALE);
      expect(student.status).toBe(StudentStatus.WAITING);
    });

    it("should create a student with provided id", () => {
      const id = "student-123";
      const student = Student.create(
        {
          campusId: validCampusId,
          studentCode: validStudentCode,
          fullName: "Test Student",
          email: null,
          phoneNumber: null,
          address: null,
          dateOfBirth: null,
          nickname: null,
          gender: null,
        },
        id,
      );

      expect(student.id).toBe(id);
    });

    it("should throw error for missing campusId", () => {
      expect(() =>
        Student.create({
          campusId: "",
          studentCode: validStudentCode,
          fullName: "Test Student",
          email: null,
          phoneNumber: null,
          address: null,
          dateOfBirth: null,
          nickname: null,
          gender: null,
        }),
      ).toThrow("Campus ID is required for student.");
    });

    it("should throw error for empty fullName", () => {
      expect(() =>
        Student.create({
          campusId: validCampusId,
          studentCode: validStudentCode,
          fullName: "",
          email: null,
          phoneNumber: null,
          address: null,
          dateOfBirth: null,
          nickname: null,
          gender: null,
        }),
      ).toThrow("Full name is required and must be at least 2 characters.");
    });

    it("should throw error for fullName less than 2 characters", () => {
      expect(() =>
        Student.create({
          campusId: validCampusId,
          studentCode: validStudentCode,
          fullName: "A",
          email: null,
          phoneNumber: null,
          address: null,
          dateOfBirth: null,
          nickname: null,
          gender: null,
        }),
      ).toThrow("Full name is required and must be at least 2 characters.");
    });

    it("should throw error for invalid email format", () => {
      expect(() =>
        Student.create({
          campusId: validCampusId,
          studentCode: validStudentCode,
          fullName: "Test Student",
          email: "invalid-email",
          phoneNumber: null,
          address: null,
          dateOfBirth: null,
          nickname: null,
          gender: null,
        }),
      ).toThrow("Email, if provided, must be a valid email address.");
    });

    it("should allow null email", () => {
      const student = Student.create({
        campusId: validCampusId,
        studentCode: validStudentCode,
        fullName: "Test Student",
        email: null,
        phoneNumber: null,
        address: null,
        dateOfBirth: null,
        nickname: null,
        gender: null,
      });

      expect(student.email).toBeNull();
    });

    it("should default status to ACTIVE", () => {
      const student = Student.create({
        campusId: validCampusId,
        studentCode: validStudentCode,
        fullName: "Test Student",
        email: null,
        phoneNumber: null,
        address: null,
        dateOfBirth: null,
        nickname: null,
        gender: null,
      });

      expect(student.status).toBe(StudentStatus.ACTIVE);
    });

    it("should default isArchived to false", () => {
      const student = Student.create({
        campusId: validCampusId,
        studentCode: validStudentCode,
        fullName: "Test Student",
        email: null,
        phoneNumber: null,
        address: null,
        dateOfBirth: null,
        nickname: null,
        gender: null,
      });

      expect(student.isArchived).toBe(false);
    });
  });

  describe("updateProfile", () => {
    let student: Student;

    beforeEach(() => {
      student = Student.create({
        campusId: validCampusId,
        studentCode: validStudentCode,
        fullName: "Original Name",
        email: validEmail,
        phoneNumber: validPhoneNumber,
        address: "Original Address",
        dateOfBirth: new Date("2018-01-01"),
        nickname: "Original Nickname",
        gender: Gender.MALE,
        status: StudentStatus.ACTIVE,
      });
    });

    it("should update fullName", () => {
      student.updateProfile({ fullName: "Updated Name" });

      expect(student.fullName).toBe("Updated Name");
    });

    it("should update email", () => {
      student.updateProfile({ email: "new@example.com" });

      expect(student.email).toBe("new@example.com");
    });

    it("should set email to null", () => {
      student.updateProfile({ email: null });

      expect(student.email).toBeNull();
    });

    it("should update phoneNumber", () => {
      student.updateProfile({ phoneNumber: "+12025551234" });

      expect(student.phoneNumber).toBe("+12025551234");
    });

    it("should set phoneNumber to null", () => {
      student.updateProfile({ phoneNumber: null });

      expect(student.phoneNumber).toBeNull();
    });

    it("should update address", () => {
      student.updateProfile({ address: "New Address" });

      expect(student.address).toBe("New Address");
    });

    it("should set address to null", () => {
      student.updateProfile({ address: null });

      expect(student.address).toBeNull();
    });

    it("should update dateOfBirth", () => {
      const newDate = new Date("2017-05-15");
      student.updateProfile({ dateOfBirth: newDate });

      expect(student.dateOfBirth).toEqual(newDate);
    });

    it("should set dateOfBirth to null", () => {
      student.updateProfile({ dateOfBirth: null });

      expect(student.dateOfBirth).toBeNull();
    });

    it("should update nickname", () => {
      student.updateProfile({ nickname: "New Nickname" });

      expect(student.nickname).toBe("New Nickname");
    });

    it("should set nickname to null", () => {
      student.updateProfile({ nickname: null });

      expect(student.nickname).toBeNull();
    });

    it("should update gender", () => {
      student.updateProfile({ gender: Gender.FEMALE });

      expect(student.gender).toBe(Gender.FEMALE);
    });

    it("should set gender to null", () => {
      student.updateProfile({ gender: null });

      expect(student.gender).toBeNull();
    });

    it("should update status", () => {
      student.updateProfile({ status: StudentStatus.GRADUATED });

      expect(student.status).toBe(StudentStatus.GRADUATED);
    });

    it("should update multiple fields at once", () => {
      student.updateProfile({
        fullName: "New Name",
        email: "new@example.com",
        address: "New Address",
        gender: Gender.OTHER,
      });

      expect(student.fullName).toBe("New Name");
      expect(student.email).toBe("new@example.com");
      expect(student.address).toBe("New Address");
      expect(student.gender).toBe(Gender.OTHER);
    });

    it("should update updatedAt timestamp", () => {
      const originalUpdatedAt = student.updatedAt;

      jest.useFakeTimers();
      jest.advanceTimersByTime(1000);

      student.updateProfile({ fullName: "New Name" });

      expect(student.updatedAt.getTime()).toBeGreaterThan(
        originalUpdatedAt.getTime(),
      );

      jest.useRealTimers();
    });

    it("should not change campusId (immutable)", () => {
      const originalCampusId = student.campusId;

      // campusId is not part of UpdateStudentData, so the entity preserves campusId through updates
      student.updateProfile({ fullName: "New Name" });

      expect(student.campusId).toBe(originalCampusId);
    });

    it("should not change studentCode through updateProfile", () => {
      const originalCode = student.studentCode;

      student.updateProfile({ fullName: "New Name" });

      expect(student.studentCode).toBe(originalCode);
    });
  });

  describe("archive", () => {
    it("should set isArchived to true", () => {
      const student = Student.create({
        campusId: validCampusId,
        studentCode: validStudentCode,
        fullName: "Test Student",
        email: null,
        phoneNumber: null,
        address: null,
        dateOfBirth: null,
        nickname: null,
        gender: null,
        isArchived: false,
      });

      student.archive();

      expect(student.isArchived).toBe(true);
    });

    it("should set status to DROPPED", () => {
      const student = Student.create({
        campusId: validCampusId,
        studentCode: validStudentCode,
        fullName: "Test Student",
        email: null,
        phoneNumber: null,
        address: null,
        dateOfBirth: null,
        nickname: null,
        gender: null,
        status: StudentStatus.ACTIVE,
      });

      student.archive();

      expect(student.status).toBe(StudentStatus.DROPPED);
    });

    it("should update updatedAt timestamp", () => {
      const student = Student.create({
        campusId: validCampusId,
        studentCode: validStudentCode,
        fullName: "Test Student",
        email: null,
        phoneNumber: null,
        address: null,
        dateOfBirth: null,
        nickname: null,
        gender: null,
      });
      const originalUpdatedAt = student.updatedAt;

      jest.useFakeTimers();
      jest.advanceTimersByTime(1000);

      student.archive();

      expect(student.updatedAt.getTime()).toBeGreaterThan(
        originalUpdatedAt.getTime(),
      );

      jest.useRealTimers();
    });
  });

  describe("restore", () => {
    it("should set isArchived to false", () => {
      const student = Student.create({
        campusId: validCampusId,
        studentCode: validStudentCode,
        fullName: "Test Student",
        email: null,
        phoneNumber: null,
        address: null,
        dateOfBirth: null,
        nickname: null,
        gender: null,
        isArchived: true,
      });

      student.restore();

      expect(student.isArchived).toBe(false);
    });

    it("should set status to ACTIVE", () => {
      const student = Student.create({
        campusId: validCampusId,
        studentCode: validStudentCode,
        fullName: "Test Student",
        email: null,
        phoneNumber: null,
        address: null,
        dateOfBirth: null,
        nickname: null,
        gender: null,
        status: StudentStatus.DROPPED,
        isArchived: true,
      });

      student.restore();

      expect(student.status).toBe(StudentStatus.ACTIVE);
    });

    it("should update updatedAt timestamp", () => {
      const student = Student.create({
        campusId: validCampusId,
        studentCode: validStudentCode,
        fullName: "Test Student",
        email: null,
        phoneNumber: null,
        address: null,
        dateOfBirth: null,
        nickname: null,
        gender: null,
        isArchived: true,
      });
      const originalUpdatedAt = student.updatedAt;

      jest.useFakeTimers();
      jest.advanceTimersByTime(1000);

      student.restore();

      expect(student.updatedAt.getTime()).toBeGreaterThan(
        originalUpdatedAt.getTime(),
      );

      jest.useRealTimers();
    });
  });

  describe("different campuses can have same student code", () => {
    it("should allow creating students with same code for different campuses", () => {
      const campus1 = "campus-1-id";
      const campus2 = "campus-2-id";
      const sameCode = "2025-000001";

      const student1 = Student.create({
        campusId: campus1,
        studentCode: sameCode,
        fullName: "Student One",
        email: null,
        phoneNumber: null,
        address: null,
        dateOfBirth: null,
        nickname: null,
        gender: null,
      });

      const student2 = Student.create({
        campusId: campus2,
        studentCode: sameCode,
        fullName: "Student Two",
        email: null,
        phoneNumber: null,
        address: null,
        dateOfBirth: null,
        nickname: null,
        gender: null,
      });

      expect(student1.studentCode).toBe(sameCode);
      expect(student2.studentCode).toBe(sameCode);
      expect(student1.campusId).toBe(campus1);
      expect(student2.campusId).toBe(campus2);
      expect(student1.id).not.toBe(student2.id);
    });
  });
});
