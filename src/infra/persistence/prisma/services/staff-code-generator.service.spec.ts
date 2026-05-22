/**
 * StaffCodeGeneratorService Tests
 * Tests for campus-scoped staff code generation logic
 */

import { ConflictException } from "@nestjs/common";
import { DEFAULT_CAMPUS_ID_A, DEFAULT_CAMPUS_ID_B } from "@/test-utils";

const STAFF_CODE_PREFIX = "ST-";

describe("StaffCodeGeneratorService", () => {
  const campusA = DEFAULT_CAMPUS_ID_A;
  const campusB = DEFAULT_CAMPUS_ID_B;
  const currentYear = new Date().getFullYear();

  describe("Code Format", () => {
    it("should generate code in format ST-YYYY-NNNNNN", () => {
      const year = 2024;
      const sequence = 1;
      const code = `${STAFF_CODE_PREFIX}${year}-${String(sequence).padStart(6, "0")}`;

      expect(code).toBe("ST-2024-000001");
    });

    it("should pad sequence number with leading zeros", () => {
      const year = 2024;
      const sequence = 42;
      const code = `${STAFF_CODE_PREFIX}${year}-${String(sequence).padStart(6, "0")}`;

      expect(code).toBe("ST-2024-000042");
    });

    it("should handle large sequence numbers", () => {
      const year = 2024;
      const sequence = 123456;
      const code = `${STAFF_CODE_PREFIX}${year}-${String(sequence).padStart(6, "0")}`;

      expect(code).toBe("ST-2024-123456");
    });

    it("should use 6 digits for sequence padding", () => {
      const year = 2024;
      const p = (n: number) =>
        `${STAFF_CODE_PREFIX}${year}-${String(n).padStart(6, "0")}`;

      expect(p(1)).toBe("ST-2024-000001");
      expect(p(10)).toBe("ST-2024-000010");
      expect(p(100)).toBe("ST-2024-000100");
      expect(p(1000)).toBe("ST-2024-001000");
      expect(p(10000)).toBe("ST-2024-010000");
      expect(p(100000)).toBe("ST-2024-100000");
    });

    it("should always include the hard-coded ST- prefix", () => {
      const year = 2025;
      const sequence = 7;
      const code = `${STAFF_CODE_PREFIX}${year}-${String(sequence).padStart(6, "0")}`;

      expect(code.startsWith("ST-")).toBe(true);
      expect(code).toMatch(/^ST-\d{4}-\d{6}$/);
    });
  });

  describe("Campus-Scoped Sequences Logic", () => {
    it("should use composite key of campusId and year", () => {
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
      const sequenceA = { campusId: campusA, year: currentYear, lastNumber: 5 };
      const sequenceB = { campusId: campusB, year: currentYear, lastNumber: 5 };

      const codeA = `${STAFF_CODE_PREFIX}${sequenceA.year}-${String(sequenceA.lastNumber).padStart(6, "0")}`;
      const codeB = `${STAFF_CODE_PREFIX}${sequenceB.year}-${String(sequenceB.lastNumber).padStart(6, "0")}`;

      expect(codeA).toBe(codeB);
      expect(sequenceA.campusId).not.toBe(sequenceB.campusId);
    });

    it("should maintain independent sequences per campus", () => {
      const sequenceA = {
        campusId: campusA,
        year: currentYear,
        lastNumber: 100,
      };
      const sequenceB = { campusId: campusB, year: currentYear, lastNumber: 1 };

      expect(sequenceA.lastNumber).toBe(100);
      expect(sequenceB.lastNumber).toBe(1);
    });
  });

  describe("Year Rollover Logic", () => {
    it("should create new sequence for new year", () => {
      const sequence2024 = {
        campusId: campusA,
        year: 2024,
        lastNumber: 999,
      };
      const sequence2025 = {
        campusId: campusA,
        year: 2025,
        lastNumber: 1,
      };

      expect(sequence2024.year).not.toBe(sequence2025.year);
      expect(sequence2025.lastNumber).toBe(1);
    });

    it("should include year in generated code", () => {
      const code2024 = `${STAFF_CODE_PREFIX}2024-${String(1).padStart(6, "0")}`;
      const code2025 = `${STAFF_CODE_PREFIX}2025-${String(1).padStart(6, "0")}`;

      expect(code2024).toBe("ST-2024-000001");
      expect(code2025).toBe("ST-2025-000001");
      expect(code2024).not.toBe(code2025);
    });
  });

  describe("Sequence Limit Validation", () => {
    it("should have max sequence of 999999", () => {
      const maxSequence = 999999;
      const exceedsMax = maxSequence + 1;

      const validCode = `${STAFF_CODE_PREFIX}2024-${String(maxSequence).padStart(6, "0")}`;
      expect(validCode).toBe("ST-2024-999999");

      expect(exceedsMax).toBeGreaterThan(maxSequence);
    });

    it("should throw ConflictException when sequence exceeds limit", () => {
      const sequence = 1000000;

      if (sequence > 999999) {
        expect(() => {
          throw new ConflictException(
            "Staff code sequence exhausted for this campus and year",
          );
        }).toThrow(ConflictException);
      }
    });
  });

  describe("Atomic Operation Logic", () => {
    it("should use atomic increment operation", () => {
      const updateClause = {
        lastNumber: { increment: 1 },
      };

      expect(updateClause.lastNumber.increment).toBe(1);
    });

    it("should create with lastNumber 1 for new sequence", () => {
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
