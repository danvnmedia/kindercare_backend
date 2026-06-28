import { BadRequestException, NotFoundException } from "@nestjs/common";

import {
  BulkAssignStaffToClassUseCase,
  type BulkAssignStaffItem,
} from "./bulk-assign-staff-to-class.use-case";
import { ClassStaffRepository } from "../../ports/class-staff.repository";
import { ClassRepository } from "../../ports/class.repository";
import { ClassStaffErrorCode } from "../../class-staff-error-codes";
import { StaffRepository } from "@/application/user-management/ports/staff.repository";
import {
  TransactionContext,
  UnitOfWorkPort,
} from "@/application/ports/unit-of-work.port";
import { Class } from "@/domain/class-management/entities/class.entity";
import { ClassStaff } from "@/domain/class-management/entities/class-staff.entity";
import { ClassStaffRole } from "@/domain/class-management/enums/class-staff-role.enum";
import { Staff } from "@/domain/user-management/entities/staff.entity";
import { User } from "@/domain/user-management/user.entity";

/**
 * AC-8 (race-condition rollback) is documented behavior, not a happy path. A
 * unique-violation firing inside `unitOfWork.run` after validation is not
 * deterministically triggerable from the unit-test boundary — the surrounding
 * transaction wraps both `createClassStaff` and `recordAudit`, so a thrown
 * error in either propagates out of `unitOfWork.run`. Verified at the
 * integration layer (see `audit-atomicity.integration.spec.ts` for the
 * companion atomicity guarantees).
 */

const ACTOR_ID = "actor-1";
const CAMPUS_ID = "campus-1";
const OTHER_CAMPUS_ID = "campus-2";
const CLASS_ID = "class-1";

function buildActor(): User {
  return User.reconstitute(
    {
      clerkUid: "user_bulkassign",
      isActive: true,
      profile: {
        type: "staff",
        id: ACTOR_ID,
        fullName: "Alice Nguyen",
        email: null,
        phoneNumber: null,
        dateOfBirth: null,
        gender: null,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    ACTOR_ID,
  );
}

function createMockClass(id: string, belongsToCampusId: string): Class {
  return Class.create(
    {
      name: "Test Class",
      campusId: belongsToCampusId,
      gradeLevelId: "grade-1",
      schoolYearId: "school-year-1",
    },
    id,
  );
}

function createMockStaff(id: string, belongsToCampusId: string): Staff {
  return Staff.create(
    {
      campusId: belongsToCampusId,
      staffCode: "ST-2025-000001",
      fullName: `Staff ${id}`,
      email: `${id}@example.com`,
      phoneNumber: "+84912345678",
      address: null,
      dateOfBirth: null,
      gender: null,
    },
    id,
  );
}

describe("BulkAssignStaffToClassUseCase", () => {
  let useCase: BulkAssignStaffToClassUseCase;
  let mockClassStaffRepository: jest.Mocked<ClassStaffRepository>;
  let mockClassRepository: jest.Mocked<ClassRepository>;
  let mockStaffRepository: jest.Mocked<StaffRepository>;
  let unitOfWork: jest.Mocked<UnitOfWorkPort>;
  let mockTx: jest.Mocked<TransactionContext>;
  let actor: User;

  beforeEach(() => {
    mockClassStaffRepository = {
      findByPair: jest.fn().mockResolvedValue(null),
      findHomeroomByClassId: jest.fn().mockResolvedValue(null),
      findByClassId: jest.fn(),
      findByStaffId: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteByClassId: jest.fn(),
      deleteByStaffId: jest.fn(),
    } as unknown as jest.Mocked<ClassStaffRepository>;

    mockClassRepository = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<ClassRepository>;

    mockStaffRepository = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<StaffRepository>;

    mockTx = {
      createClassStaff: jest.fn().mockImplementation(async (data) => ({
        classId: data.classId,
        staffId: data.staffId,
      })),
      recordAudit: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<TransactionContext>;

    unitOfWork = {
      run: jest.fn((task) => task(mockTx)),
    } as unknown as jest.Mocked<UnitOfWorkPort>;

    actor = buildActor();

    useCase = new BulkAssignStaffToClassUseCase(
      mockClassStaffRepository,
      mockClassRepository,
      mockStaffRepository,
      unitOfWork,
    );
  });

  describe("AC-1: Happy path — mixed-role 4-row batch", () => {
    it("persists all 4 rows and emits 4 ASSIGN_STAFF_TO_CLASS audits inside one UoW", async () => {
      const rows: BulkAssignStaffItem[] = [
        { staffId: "s1", role: ClassStaffRole.HOMEROOM },
        { staffId: "s2", role: ClassStaffRole.ASSISTANT },
        { staffId: "s3", role: ClassStaffRole.ASSISTANT },
        { staffId: "s4", role: ClassStaffRole.BOARDING },
      ];

      mockClassRepository.findById.mockResolvedValue(
        createMockClass(CLASS_ID, CAMPUS_ID),
      );
      mockStaffRepository.findById.mockImplementation(async (id) =>
        createMockStaff(id, CAMPUS_ID),
      );

      const result = await useCase.execute(
        { campusId: CAMPUS_ID, classId: CLASS_ID, staff: rows },
        actor,
      );

      expect(result.assigned).toHaveLength(4);
      expect(result.skipped).toHaveLength(0);
      expect(unitOfWork.run).toHaveBeenCalledTimes(1);
      expect(mockTx.createClassStaff).toHaveBeenCalledTimes(4);
      expect(mockTx.recordAudit).toHaveBeenCalledTimes(4);
      // HOMEROOM pre-batch lookup fires once because there is one HOMEROOM row.
      expect(
        mockClassStaffRepository.findHomeroomByClassId,
      ).toHaveBeenCalledTimes(1);
    });
  });

  describe("AC-2: Mixed validity", () => {
    it("persists valid rows and reports skipped[] with stable reason codes", async () => {
      const rows: BulkAssignStaffItem[] = [
        { staffId: "s1", role: ClassStaffRole.ASSISTANT },
        { staffId: "s2", role: ClassStaffRole.ASSISTANT },
        { staffId: "s3", role: ClassStaffRole.ASSISTANT },
      ];

      mockClassRepository.findById.mockResolvedValue(
        createMockClass(CLASS_ID, CAMPUS_ID),
      );
      mockStaffRepository.findById.mockImplementation(async (id) => {
        if (id === "s3") return createMockStaff(id, OTHER_CAMPUS_ID);
        return createMockStaff(id, CAMPUS_ID);
      });
      mockClassStaffRepository.findByPair.mockImplementation(
        async (_classId, staffId) =>
          staffId === "s2"
            ? ClassStaff.create({
                classId: CLASS_ID,
                staffId: "s2",
                role: ClassStaffRole.ASSISTANT,
              })
            : null,
      );

      const result = await useCase.execute(
        { campusId: CAMPUS_ID, classId: CLASS_ID, staff: rows },
        actor,
      );

      expect(result.assigned).toHaveLength(1);
      expect(result.assigned[0]!.staffId).toBe("s1");
      expect(result.skipped).toEqual([
        { staffId: "s2", reason: ClassStaffErrorCode.STAFF_ALREADY_ASSIGNED },
        { staffId: "s3", reason: ClassStaffErrorCode.STAFF_NOT_IN_CAMPUS },
      ]);
      expect(mockTx.createClassStaff).toHaveBeenCalledTimes(1);
      expect(mockTx.recordAudit).toHaveBeenCalledTimes(1);
    });
  });

  describe("AC-3: All-skipped batch", () => {
    it("returns assigned=[] and never opens a transaction", async () => {
      const rows: BulkAssignStaffItem[] = [
        { staffId: "s1", role: ClassStaffRole.ASSISTANT },
        { staffId: "s2", role: ClassStaffRole.ASSISTANT },
        { staffId: "s3", role: ClassStaffRole.ASSISTANT },
      ];

      mockClassRepository.findById.mockResolvedValue(
        createMockClass(CLASS_ID, CAMPUS_ID),
      );
      mockStaffRepository.findById.mockImplementation(async (id) =>
        createMockStaff(id, CAMPUS_ID),
      );
      mockClassStaffRepository.findByPair.mockImplementation(
        async (_classId, staffId) =>
          ClassStaff.create({
            classId: CLASS_ID,
            staffId,
            role: ClassStaffRole.ASSISTANT,
          }),
      );

      const result = await useCase.execute(
        { campusId: CAMPUS_ID, classId: CLASS_ID, staff: rows },
        actor,
      );

      expect(result.assigned).toHaveLength(0);
      expect(result.skipped).toHaveLength(3);
      expect(unitOfWork.run).not.toHaveBeenCalled();
      expect(mockTx.createClassStaff).not.toHaveBeenCalled();
      expect(mockTx.recordAudit).not.toHaveBeenCalled();
    });
  });

  describe("AC-4: Whole-call class lookup → 404", () => {
    it("throws NotFoundException when the class does not exist", async () => {
      mockClassRepository.findById.mockResolvedValue(null);

      await expect(
        useCase.execute(
          {
            campusId: CAMPUS_ID,
            classId: CLASS_ID,
            staff: [{ staffId: "s1", role: ClassStaffRole.ASSISTANT }],
          },
          actor,
        ),
      ).rejects.toThrow(NotFoundException);

      expect(mockStaffRepository.findById).not.toHaveBeenCalled();
      expect(unitOfWork.run).not.toHaveBeenCalled();
    });

    it("throws NotFoundException with the same body when the class belongs to a different campus (D9)", async () => {
      mockClassRepository.findById.mockResolvedValue(
        createMockClass(CLASS_ID, OTHER_CAMPUS_ID),
      );

      await expect(
        useCase.execute(
          {
            campusId: CAMPUS_ID,
            classId: CLASS_ID,
            staff: [{ staffId: "s1", role: ClassStaffRole.ASSISTANT }],
          },
          actor,
        ),
      ).rejects.toThrow(
        new NotFoundException(`Class with ID ${CLASS_ID} not found`),
      );

      expect(mockStaffRepository.findById).not.toHaveBeenCalled();
      expect(unitOfWork.run).not.toHaveBeenCalled();
    });
  });

  describe("AC-5: Whole-call MULTIPLE_HOMEROOM_IN_BATCH", () => {
    it("rejects payloads with two HOMEROOM rows before any DB call", async () => {
      const rows: BulkAssignStaffItem[] = [
        { staffId: "s1", role: ClassStaffRole.HOMEROOM },
        { staffId: "s2", role: ClassStaffRole.HOMEROOM },
      ];

      await expect(
        useCase.execute(
          { campusId: CAMPUS_ID, classId: CLASS_ID, staff: rows },
          actor,
        ),
      ).rejects.toThrow(
        new BadRequestException(
          ClassStaffErrorCode.MULTIPLE_HOMEROOM_IN_BATCH,
        ),
      );

      expect(mockClassRepository.findById).not.toHaveBeenCalled();
      expect(mockStaffRepository.findById).not.toHaveBeenCalled();
      expect(unitOfWork.run).not.toHaveBeenCalled();
    });
  });

  describe("AC-6: Whole-call payload-shape rejections", () => {
    it("throws BATCH_EMPTY when staff[] is empty", async () => {
      await expect(
        useCase.execute(
          { campusId: CAMPUS_ID, classId: CLASS_ID, staff: [] },
          actor,
        ),
      ).rejects.toThrow(
        new BadRequestException(ClassStaffErrorCode.BATCH_EMPTY),
      );

      expect(mockClassRepository.findById).not.toHaveBeenCalled();
    });

    it("throws BATCH_TOO_LARGE when staff[] exceeds 100 rows", async () => {
      const rows: BulkAssignStaffItem[] = Array.from(
        { length: 101 },
        (_, i) => ({
          staffId: `s${i}`,
          role: ClassStaffRole.ASSISTANT,
        }),
      );

      await expect(
        useCase.execute(
          { campusId: CAMPUS_ID, classId: CLASS_ID, staff: rows },
          actor,
        ),
      ).rejects.toThrow(
        new BadRequestException(ClassStaffErrorCode.BATCH_TOO_LARGE),
      );

      expect(mockClassRepository.findById).not.toHaveBeenCalled();
    });

    it("throws DUPLICATE_STAFF_IN_BATCH when the same staffId appears twice", async () => {
      const rows: BulkAssignStaffItem[] = [
        { staffId: "s1", role: ClassStaffRole.ASSISTANT },
        { staffId: "s1", role: ClassStaffRole.BOARDING },
      ];

      await expect(
        useCase.execute(
          { campusId: CAMPUS_ID, classId: CLASS_ID, staff: rows },
          actor,
        ),
      ).rejects.toThrow(
        new BadRequestException(
          ClassStaffErrorCode.DUPLICATE_STAFF_IN_BATCH,
        ),
      );

      expect(mockClassRepository.findById).not.toHaveBeenCalled();
    });
  });

  describe("AC-7: Per-row HOMEROOM conflict", () => {
    it("skips the HOMEROOM row but persists the two ASSISTANTs", async () => {
      const rows: BulkAssignStaffItem[] = [
        { staffId: "s5", role: ClassStaffRole.HOMEROOM },
        { staffId: "s6", role: ClassStaffRole.ASSISTANT },
        { staffId: "s7", role: ClassStaffRole.ASSISTANT },
      ];

      mockClassRepository.findById.mockResolvedValue(
        createMockClass(CLASS_ID, CAMPUS_ID),
      );
      mockStaffRepository.findById.mockImplementation(async (id) =>
        createMockStaff(id, CAMPUS_ID),
      );
      mockClassStaffRepository.findHomeroomByClassId.mockResolvedValue(
        ClassStaff.create({
          classId: CLASS_ID,
          staffId: "s_existing",
          role: ClassStaffRole.HOMEROOM,
        }),
      );

      const result = await useCase.execute(
        { campusId: CAMPUS_ID, classId: CLASS_ID, staff: rows },
        actor,
      );

      expect(result.assigned).toHaveLength(2);
      expect(result.assigned.map((cs) => cs.staffId)).toEqual(["s6", "s7"]);
      expect(result.skipped).toEqual([
        {
          staffId: "s5",
          reason: ClassStaffErrorCode.HOMEROOM_ALREADY_ASSIGNED,
        },
      ]);
      expect(mockTx.createClassStaff).toHaveBeenCalledTimes(2);
      expect(mockTx.recordAudit).toHaveBeenCalledTimes(2);
    });
  });

  describe("AC-9: Audit emission shape", () => {
    it("emits one ASSIGN_STAFF_TO_CLASS audit per persisted row with the same context shape as the single-row use case", async () => {
      mockClassRepository.findById.mockResolvedValue(
        createMockClass(CLASS_ID, CAMPUS_ID),
      );
      mockStaffRepository.findById.mockImplementation(async (id) =>
        createMockStaff(id, CAMPUS_ID),
      );

      await useCase.execute(
        {
          campusId: CAMPUS_ID,
          classId: CLASS_ID,
          staff: [{ staffId: "s1", role: ClassStaffRole.ASSISTANT }],
        },
        actor,
      );

      expect(mockTx.recordAudit).toHaveBeenCalledTimes(1);
      const payload = mockTx.recordAudit.mock.calls[0]![0];
      expect(payload.actorId).toBe(ACTOR_ID);
      expect(payload.action).toBe("ASSIGN_STAFF_TO_CLASS");
      expect(payload.targetType).toBe("staff");
      expect(payload.targetId).toBe("s1");
      expect(payload.campusId).toBe(CAMPUS_ID);
      expect(payload.context).toEqual({
        actorName: "Alice Nguyen",
        classId: CLASS_ID,
        role: ClassStaffRole.ASSISTANT,
      });
    });
  });
});
