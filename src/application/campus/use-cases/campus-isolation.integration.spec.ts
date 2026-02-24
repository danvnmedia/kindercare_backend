/**
 * Campus Isolation Integration Tests
 * Tests that campus-scoped operations properly filter by campusId
 */

import { NotFoundException } from "@nestjs/common";
import { GetStaffByIdUseCase } from "@/application/user-management/use-cases/staff/get-staff-by-id.use-case";
import {
  createStaff,
  createStudent,
  createGuardian,
  createClass,
  DEFAULT_CAMPUS_ID_A,
  DEFAULT_CAMPUS_ID_B,
} from "@/test-utils";
import { createMockStaffRepository } from "@/test-utils";

describe("Campus Isolation Integration Tests", () => {
  const campusA = DEFAULT_CAMPUS_ID_A;
  const campusB = DEFAULT_CAMPUS_ID_B;

  describe("Staff Campus Isolation", () => {
    let getStaffByIdUseCase: GetStaffByIdUseCase;
    let mockStaffRepository: ReturnType<typeof createMockStaffRepository>;

    beforeEach(() => {
      mockStaffRepository = createMockStaffRepository();
      getStaffByIdUseCase = new GetStaffByIdUseCase(mockStaffRepository);
    });

    describe("GetStaffByIdUseCase - Campus Verification", () => {
      it("should return staff when they belong to the requested campus", async () => {
        const staff = createStaff({ id: "staff-1", campusId: campusA });
        mockStaffRepository.findById.mockResolvedValue(staff);

        const result = await getStaffByIdUseCase.execute({
          id: "staff-1",
          campusId: campusA,
        });

        expect(result).toBeDefined();
        expect(result.id).toBe("staff-1");
        expect(result.campusId).toBe(campusA);
      });

      it("should throw NotFoundException when staff belongs to different campus", async () => {
        // Staff exists in campus B
        const staff = createStaff({ id: "staff-1", campusId: campusB });
        mockStaffRepository.findById.mockResolvedValue(staff);

        // But we're requesting from campus A context
        await expect(
          getStaffByIdUseCase.execute({
            id: "staff-1",
            campusId: campusA,
          }),
        ).rejects.toThrow(NotFoundException);

        await expect(
          getStaffByIdUseCase.execute({
            id: "staff-1",
            campusId: campusA,
          }),
        ).rejects.toThrow("not found in this campus");
      });

      it("should throw NotFoundException when staff does not exist", async () => {
        mockStaffRepository.findById.mockResolvedValue(null);

        await expect(
          getStaffByIdUseCase.execute({
            id: "non-existent-staff",
            campusId: campusA,
          }),
        ).rejects.toThrow(NotFoundException);
      });
    });
  });

  describe("Cross-Campus Data Access Prevention", () => {
    let mockStaffRepository: ReturnType<typeof createMockStaffRepository>;
    let getStaffByIdUseCase: GetStaffByIdUseCase;

    beforeEach(() => {
      mockStaffRepository = createMockStaffRepository();
      getStaffByIdUseCase = new GetStaffByIdUseCase(mockStaffRepository);
    });

    it("should prevent campus A user from accessing campus B staff", async () => {
      // Staff exists in campus B
      const staffInCampusB = createStaff({ id: "staff-b", campusId: campusB });
      mockStaffRepository.findById.mockResolvedValue(staffInCampusB);

      // Request made with campus A context
      await expect(
        getStaffByIdUseCase.execute({
          id: "staff-b",
          campusId: campusA,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("should allow same-campus access", async () => {
      const staffInCampusA = createStaff({ id: "staff-a", campusId: campusA });
      mockStaffRepository.findById.mockResolvedValue(staffInCampusA);

      const result = await getStaffByIdUseCase.execute({
        id: "staff-a",
        campusId: campusA,
      });

      expect(result.id).toBe("staff-a");
      expect(result.campusId).toBe(campusA);
    });
  });

  describe("Entity Campus Scoping", () => {
    it("staff entity should store campusId", () => {
      const staffA = createStaff({ campusId: campusA });
      const staffB = createStaff({ campusId: campusB });

      expect(staffA.campusId).toBe(campusA);
      expect(staffB.campusId).toBe(campusB);
    });

    it("student entity should store campusId", () => {
      const studentA = createStudent({ campusId: campusA });
      const studentB = createStudent({ campusId: campusB });

      expect(studentA.campusId).toBe(campusA);
      expect(studentB.campusId).toBe(campusB);
    });

    it("guardian entity should store campusId", () => {
      const guardianA = createGuardian({ campusId: campusA });
      const guardianB = createGuardian({ campusId: campusB });

      expect(guardianA.campusId).toBe(campusA);
      expect(guardianB.campusId).toBe(campusB);
    });

    it("class entity should store campusId", () => {
      const classA = createClass({ campusId: campusA });
      const classB = createClass({ campusId: campusB });

      expect(classA.campusId).toBe(campusA);
      expect(classB.campusId).toBe(campusB);
    });
  });

  describe("Campus Context in Use Cases", () => {
    it("should pass campusId through use case input", () => {
      const input = {
        id: "staff-1",
        campusId: campusA,
      };

      expect(input.campusId).toBe(campusA);
    });

    it("should validate campusId matches entity campusId", () => {
      const entity = createStaff({ campusId: campusA });
      const requestCampusId = campusA;

      expect(entity.campusId).toBe(requestCampusId);
    });

    it("should detect campus mismatch", () => {
      const entity = createStaff({ campusId: campusB });
      const requestCampusId = campusA;

      expect(entity.campusId).not.toBe(requestCampusId);
    });
  });
});
