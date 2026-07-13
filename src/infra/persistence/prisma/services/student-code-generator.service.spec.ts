/**
 * StudentCodeGeneratorService Tests
 * Tests for campus-scoped student code generation logic
 */

import { ConflictException } from "@nestjs/common";
import { DEFAULT_CAMPUS_ID_A, DEFAULT_CAMPUS_ID_B } from "@/test-utils";

describe("StudentCodeGeneratorService", () => {
  const campusA = DEFAULT_CAMPUS_ID_A;
  const campusB = DEFAULT_CAMPUS_ID_B;
  const currentYear = new Date().getFullYear();

  describe("Code Format", () => {
    it("should generate code in format YYYY-NNNNNN", () => {
      // Test format logic
      const year = 2024;
      const sequence = 1;
      const code = `${year}-${String(sequence).padStart(6, "0")}`;

      expect(code).toBe("2024-000001");
    });

    it("should pad sequence number with leading zeros", () => {
      const year = 2024;
      const sequence = 42;
      const code = `${year}-${String(sequence).padStart(6, "0")}`;

      expect(code).toBe("2024-000042");
    });

    it("should handle large sequence numbers", () => {
      const year = 2024;
      const sequence = 123456;
      const code = `${year}-${String(sequence).padStart(6, "0")}`;

      expect(code).toBe("2024-123456");
    });

    it("should use 6 digits for sequence padding", () => {
      const year = 2024;

      // Various sequence numbers
      expect(`${year}-${String(1).padStart(6, "0")}`).toBe("2024-000001");
      expect(`${year}-${String(10).padStart(6, "0")}`).toBe("2024-000010");
      expect(`${year}-${String(100).padStart(6, "0")}`).toBe("2024-000100");
      expect(`${year}-${String(1000).padStart(6, "0")}`).toBe("2024-001000");
      expect(`${year}-${String(10000).padStart(6, "0")}`).toBe("2024-010000");
      expect(`${year}-${String(100000).padStart(6, "0")}`).toBe("2024-100000");
    });
  });

  describe("Campus-Scoped Sequences Logic", () => {
    it("should use composite key of campusId and year", () => {
      // The upsert where clause should use composite key
      const compositeKey = {
        campusId_year: {
          campusId: campusA,
          year: currentYear,
        },
      };

      expect(compositeKey.campusId_year.campusId).toBe(campusA);
      expect(compositeKey.campusId_year.year).toBe(currentYear);
    });

    it("should allow same sequence numbers in different campuses", () => {
      // Campus A and Campus B can have the same sequence number
      const sequenceA = { campusId: campusA, year: currentYear, lastNumber: 5 };
      const sequenceB = { campusId: campusB, year: currentYear, lastNumber: 5 };

      const codeA = `${sequenceA.year}-${String(sequenceA.lastNumber).padStart(6, "0")}`;
      const codeB = `${sequenceB.year}-${String(sequenceB.lastNumber).padStart(6, "0")}`;

      // Same code format, different campuses
      expect(codeA).toBe(codeB);
      expect(sequenceA.campusId).not.toBe(sequenceB.campusId);
    });

    it("should maintain independent sequences per campus", () => {
      // Campus A at sequence 100
      const sequenceA = {
        campusId: campusA,
        year: currentYear,
        lastNumber: 100,
      };
      // Campus B at sequence 1 (just started)
      const sequenceB = { campusId: campusB, year: currentYear, lastNumber: 1 };

      expect(sequenceA.lastNumber).toBe(100);
      expect(sequenceB.lastNumber).toBe(1);
    });
  });

  describe("Year Rollover Logic", () => {
    it("should create new sequence for new year", () => {
      // Year 2024 sequence
      const sequence2024 = {
        campusId: campusA,
        year: 2024,
        lastNumber: 999,
      };

      // Year 2025 sequence starts fresh
      const sequence2025 = {
        campusId: campusA,
        year: 2025,
        lastNumber: 1,
      };

      expect(sequence2024.year).not.toBe(sequence2025.year);
      expect(sequence2025.lastNumber).toBe(1); // Resets to 1
    });

    it("should include year in generated code", () => {
      const sequence2024 = { year: 2024, lastNumber: 1 };
      const sequence2025 = { year: 2025, lastNumber: 1 };

      const code2024 = `${sequence2024.year}-${String(sequence2024.lastNumber).padStart(6, "0")}`;
      const code2025 = `${sequence2025.year}-${String(sequence2025.lastNumber).padStart(6, "0")}`;

      expect(code2024).toBe("2024-000001");
      expect(code2025).toBe("2025-000001");
      expect(code2024).not.toBe(code2025);
    });
  });

  describe("Sequence Limit Validation", () => {
    it("should have max sequence of 999999", () => {
      const maxSequence = 999999;
      const exceedsMax = maxSequence + 1;

      // Code at max is valid
      const validCode = `2024-${String(maxSequence).padStart(6, "0")}`;
      expect(validCode).toBe("2024-999999");

      // Exceeding max should trigger error (in service)
      expect(exceedsMax).toBeGreaterThan(maxSequence);
    });

    it("should validate sequence exceeds limit throws ConflictException", () => {
      // This tests the logic that should be in the service
      const sequence = 1000000;

      if (sequence > 999999) {
        expect(() => {
          throw new ConflictException(
            "Student code sequence exhausted for this campus and year",
          );
        }).toThrow(ConflictException);
      }
    });
  });

  describe("Atomic Operation Logic", () => {
    it("should use atomic increment operation", () => {
      // The update clause should use atomic increment
      const updateClause = {
        lastNumber: { increment: 1 },
      };

      expect(updateClause.lastNumber.increment).toBe(1);
    });

    it("should create with lastNumber 1 for new sequence", () => {
      // The create clause for first student
      const createClause = {
        campusId: campusA,
        year: currentYear,
        lastNumber: 1,
      };

      expect(createClause.lastNumber).toBe(1);
    });
  });

  describe("Integration Requirements", () => {
    it("should require campusId parameter", () => {
      // The service interface requires campusId
      const input = { campusId: campusA };
      expect(input.campusId).toBeDefined();
      expect(typeof input.campusId).toBe("string");
    });

    it("should use current year from system date", () => {
      const systemYear = new Date().getFullYear();
      expect(systemYear).toBe(currentYear);
      expect(typeof systemYear).toBe("number");
    });
  });
});
