/**
 * Entity Creation with Campus Validation Tests
 * Tests that domain entities properly require and validate campusId
 */

import { Campus } from "@/domain/campus/entities/campus.entity";
import { Staff } from "@/domain/user-management/entities/staff.entity";
import { Student } from "@/domain/user-management/entities/student.entity";
import { Guardian } from "@/domain/user-management/entities/guardian.entity";
import { Class } from "@/domain/class-management/entities/class.entity";
import { Subject } from "@/domain/class-management/entities/subject.entity";
import { GradeLevel } from "@/domain/class-management/entities/grade-level.entity";
import { SchoolYear } from "@/domain/class-management/entities/school-year.entity";
import { DEFAULT_CAMPUS_ID_A } from "@/test-utils";

describe("Entity Creation with Campus Validation", () => {
  const validCampusId = DEFAULT_CAMPUS_ID_A;

  // Helper to create valid staff props
  const validStaffProps = {
    campusId: validCampusId,
    fullName: "John Doe",
    email: "john@test.com",
    phoneNumber: "+84901234567",
    address: null,
    dateOfBirth: null,
    gender: null,
    startDate: null,
  };

  // Helper to create valid student props
  const validStudentProps = {
    campusId: validCampusId,
    studentCode: "STU001",
    fullName: "Student Name",
    email: null,
    phoneNumber: null,
    address: null,
    dateOfBirth: null,
    nickname: null,
    gender: null,
  };

  // Helper to create valid guardian props
  const validGuardianProps = {
    campusId: validCampusId,
    fullName: "Guardian Name",
    email: "guardian@test.com",
    phoneNumber: "+84901234567",
    address: null,
    dateOfBirth: null,
    gender: null,
    occupation: null,
    workAddress: null,
  };

  describe("Campus Entity", () => {
    it("should create campus without campusId (it IS the campus)", () => {
      const campus = Campus.create({
        name: "Main Campus",
        address: "123 Main Street",
        phoneNumber: "+84901234567",
      });

      expect(campus.name).toBe("Main Campus");
      expect(campus.isActive).toBe(true);
    });

    it("should validate campus name is required", () => {
      expect(() =>
        Campus.create({
          name: "",
        }),
      ).toThrow("Campus name is required");
    });

    it("should validate campus name length", () => {
      expect(() =>
        Campus.create({
          name: "a".repeat(201),
        }),
      ).toThrow("Campus name must be at most 200 characters");
    });

    it("should validate phone number format", () => {
      expect(() =>
        Campus.create({
          name: "Test Campus",
          phoneNumber: "invalid-phone",
        }),
      ).toThrow("E.164 format");
    });
  });

  describe("Staff Entity", () => {
    it("should require campusId for staff creation", () => {
      expect(() =>
        Staff.create({
          ...validStaffProps,
          campusId: "", // Empty campusId
        }),
      ).toThrow("Campus ID is required");
    });

    it("should create staff with valid campusId", () => {
      const staff = Staff.create(validStaffProps);

      expect(staff.campusId).toBe(validCampusId);
      expect(staff.fullName).toBe("John Doe");
    });

    it("should not allow changing campusId after creation", () => {
      const staff = Staff.create(validStaffProps);

      // campusId should not be in UpdateStaffData type
      // The updateProfile method doesn't accept campusId
      staff.updateProfile({ fullName: "Jane Doe" });

      // campusId remains unchanged
      expect(staff.campusId).toBe(validCampusId);
    });

    it("should validate email format", () => {
      expect(() =>
        Staff.create({
          ...validStaffProps,
          email: "invalid-email",
        }),
      ).toThrow("valid email");
    });

    it("should validate phone number format", () => {
      expect(() =>
        Staff.create({
          ...validStaffProps,
          phoneNumber: "invalid-phone",
        }),
      ).toThrow("E.164 format");
    });
  });

  describe("Student Entity", () => {
    it("should require campusId for student creation", () => {
      expect(() =>
        Student.create({
          ...validStudentProps,
          campusId: "", // Empty campusId
        }),
      ).toThrow("Campus ID is required");
    });

    it("should create student with valid campusId", () => {
      const student = Student.create(validStudentProps);

      expect(student.campusId).toBe(validCampusId);
      expect(student.studentCode).toBe("STU001");
    });

    it("should not allow changing campusId after creation", () => {
      const student = Student.create(validStudentProps);

      // updateProfile doesn't accept campusId
      student.updateProfile({ fullName: "Updated Name" });

      expect(student.campusId).toBe(validCampusId);
    });

    it("should allow creation with studentCode", () => {
      const student = Student.create(validStudentProps);
      expect(student.studentCode).toBe("STU001");
    });
  });

  describe("Guardian Entity", () => {
    it("should require campusId for guardian creation", () => {
      expect(() =>
        Guardian.create({
          ...validGuardianProps,
          campusId: "", // Empty campusId
        }),
      ).toThrow("Campus ID is required");
    });

    it("should create guardian with valid campusId", () => {
      const guardian = Guardian.create(validGuardianProps);

      expect(guardian.campusId).toBe(validCampusId);
      expect(guardian.fullName).toBe("Guardian Name");
    });
  });

  describe("Class Entity", () => {
    const validClassProps = {
      campusId: validCampusId,
      name: "Class A",
      gradeLevelId: "grade-1",
      schoolYearId: "year-1",
      description: null,
    };

    it("should require campusId for class creation", () => {
      expect(() =>
        Class.create({
          ...validClassProps,
          campusId: "", // Empty campusId
        }),
      ).toThrow("Campus ID is required");
    });

    it("should create class with valid campusId", () => {
      const classEntity = Class.create(validClassProps);

      expect(classEntity.campusId).toBe(validCampusId);
      expect(classEntity.name).toBe("Class A");
    });

    it("should require name", () => {
      expect(() =>
        Class.create({
          ...validClassProps,
          name: "",
        }),
      ).toThrow();
    });
  });

  describe("Subject Entity", () => {
    const validSubjectProps = {
      campusId: validCampusId,
      name: "Mathematics",
    };

    it("should require campusId for subject creation", () => {
      expect(() =>
        Subject.create({
          ...validSubjectProps,
          campusId: "", // Empty campusId
        }),
      ).toThrow("Campus ID is required");
    });

    it("should create subject with valid campusId", () => {
      const subject = Subject.create(validSubjectProps);

      expect(subject.campusId).toBe(validCampusId);
      expect(subject.name).toBe("Mathematics");
    });
  });

  describe("GradeLevel Entity", () => {
    const validGradeLevelProps = {
      campusId: validCampusId,
      name: "Grade 1",
      order: 1,
    };

    it("should require campusId for grade level creation", () => {
      expect(() =>
        GradeLevel.create({
          ...validGradeLevelProps,
          campusId: "", // Empty campusId
        }),
      ).toThrow("Campus ID is required");
    });

    it("should create grade level with valid campusId", () => {
      const gradeLevel = GradeLevel.create(validGradeLevelProps);

      expect(gradeLevel.campusId).toBe(validCampusId);
      expect(gradeLevel.name).toBe("Grade 1");
    });
  });

  describe("SchoolYear Entity", () => {
    const validSchoolYearProps = {
      campusId: validCampusId,
      name: "2024-2025",
      startDate: new Date("2024-09-01"),
      endDate: new Date("2025-06-30"),
    };

    it("should require campusId for school year creation", () => {
      expect(() =>
        SchoolYear.create({
          ...validSchoolYearProps,
          campusId: "", // Empty campusId
        }),
      ).toThrow("Campus ID is required");
    });

    it("should create school year with valid campusId", () => {
      const schoolYear = SchoolYear.create(validSchoolYearProps);

      expect(schoolYear.campusId).toBe(validCampusId);
      expect(schoolYear.name).toBe("2024-2025");
    });
  });

  describe("Campus ID Immutability", () => {
    it("should preserve campusId throughout entity lifecycle", () => {
      const staff = Staff.create(validStaffProps);

      // Perform various updates
      staff.updateProfile({ fullName: "Updated Name" });
      staff.archive();
      staff.restore();
      staff.linkUser("user-123");
      staff.unlinkUser();

      // campusId should remain unchanged
      expect(staff.campusId).toBe(validCampusId);
    });

    it("should preserve campusId for student after updates", () => {
      const student = Student.create(validStudentProps);

      student.updateProfile({ fullName: "New Name", nickname: "Nick" });
      student.archive();
      student.restore();

      expect(student.campusId).toBe(validCampusId);
    });
  });
});
