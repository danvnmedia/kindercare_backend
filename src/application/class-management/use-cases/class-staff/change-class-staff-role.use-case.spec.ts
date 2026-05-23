import {
  ConflictException,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";

import { ChangeClassStaffRoleUseCase } from "./change-class-staff-role.use-case";
import { ClassStaffRepository } from "../../ports/class-staff.repository";
import { ClassRepository } from "../../ports/class.repository";
import { ClassStaffErrorCode } from "../../class-staff-error-codes";
import {
  TransactionContext,
  UnitOfWorkPort,
} from "@/application/ports/unit-of-work.port";
import { Class } from "@/domain/class-management/entities/class.entity";
import { ClassStaff } from "@/domain/class-management/entities/class-staff.entity";
import { ClassStaffRole } from "@/domain/class-management/enums/class-staff-role.enum";
import { User } from "@/domain/user-management/user.entity";

const ACTOR_ID = "actor-1";

function buildActor(): User {
  return User.reconstitute(
    {
      clerkUid: "user_changestaffrole",
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

function createMockAssignment(
  classId: string,
  staffId: string,
  role: ClassStaffRole,
): ClassStaff {
  return ClassStaff.create({ classId, staffId, role });
}

describe("ChangeClassStaffRoleUseCase", () => {
  const campusId = "campus-1";
  const otherCampusId = "campus-2";
  const classId = "class-1";
  const staffId = "staff-1";

  let useCase: ChangeClassStaffRoleUseCase;
  let mockClassStaffRepository: jest.Mocked<ClassStaffRepository>;
  let mockClassRepository: jest.Mocked<ClassRepository>;
  let unitOfWork: jest.Mocked<UnitOfWorkPort>;
  let mockTx: jest.Mocked<TransactionContext>;
  let actor: User;

  beforeEach(() => {
    mockClassStaffRepository = {
      findByPair: jest.fn(),
      findHomeroomByClassId: jest.fn(),
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

    mockTx = {
      updateClassStaff: jest
        .fn()
        .mockResolvedValue({ classId, staffId }),
      recordAudit: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<TransactionContext>;

    unitOfWork = {
      run: jest.fn((task) => task(mockTx)),
    } as unknown as jest.Mocked<UnitOfWorkPort>;

    actor = buildActor();

    useCase = new ChangeClassStaffRoleUseCase(
      mockClassStaffRepository,
      mockClassRepository,
      unitOfWork,
    );
  });

  describe("Happy path", () => {
    it("promotes ASSISTANT → HOMEROOM when slot is open and emits CHANGE_STAFF_ROLE inside the UoW (Scenario 4)", async () => {
      mockClassRepository.findById.mockResolvedValue(
        createMockClass(classId, campusId),
      );
      mockClassStaffRepository.findByPair.mockResolvedValue(
        createMockAssignment(classId, staffId, ClassStaffRole.ASSISTANT),
      );
      mockClassStaffRepository.findHomeroomByClassId.mockResolvedValue(null);

      const result = await useCase.execute(
        { campusId, classId, staffId, newRole: ClassStaffRole.HOMEROOM },
        actor,
      );

      expect(result).toBeInstanceOf(ClassStaff);
      expect(result.role).toBe(ClassStaffRole.HOMEROOM);

      // HOMEROOM uniqueness check fired (promotion path).
      expect(
        mockClassStaffRepository.findHomeroomByClassId,
      ).toHaveBeenCalledTimes(1);
      expect(
        mockClassStaffRepository.findHomeroomByClassId,
      ).toHaveBeenCalledWith(classId);

      expect(unitOfWork.run).toHaveBeenCalledTimes(1);
      expect(mockTx.updateClassStaff).toHaveBeenCalledTimes(1);
      expect(mockTx.updateClassStaff).toHaveBeenCalledWith(
        classId,
        staffId,
        expect.objectContaining({ role: ClassStaffRole.HOMEROOM }),
      );

      expect(mockTx.recordAudit).toHaveBeenCalledTimes(1);
      const payload = mockTx.recordAudit.mock.calls[0]![0];
      expect(payload.action).toBe("CHANGE_STAFF_ROLE");
      expect(payload.targetType).toBe("staff");
      expect(payload.targetId).toBe(staffId);
      expect(payload.campusId).toBe(campusId);
      expect(payload.actorId).toBe(ACTOR_ID);
      expect(payload.context).toEqual({
        actorName: "Alice Nguyen",
        classId,
        previousRole: ClassStaffRole.ASSISTANT,
        newRole: ClassStaffRole.HOMEROOM,
      });
    });

    it("demotes HOMEROOM → ASSISTANT without checking HOMEROOM uniqueness", async () => {
      mockClassRepository.findById.mockResolvedValue(
        createMockClass(classId, campusId),
      );
      mockClassStaffRepository.findByPair.mockResolvedValue(
        createMockAssignment(classId, staffId, ClassStaffRole.HOMEROOM),
      );

      const result = await useCase.execute(
        { campusId, classId, staffId, newRole: ClassStaffRole.ASSISTANT },
        actor,
      );

      expect(result.role).toBe(ClassStaffRole.ASSISTANT);

      // Demotion never risks creating a duplicate HOMEROOM, so the read is skipped.
      expect(
        mockClassStaffRepository.findHomeroomByClassId,
      ).not.toHaveBeenCalled();

      expect(mockTx.updateClassStaff).toHaveBeenCalledWith(
        classId,
        staffId,
        expect.objectContaining({ role: ClassStaffRole.ASSISTANT }),
      );
      expect(mockTx.recordAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.objectContaining({
            previousRole: ClassStaffRole.HOMEROOM,
            newRole: ClassStaffRole.ASSISTANT,
          }),
        }),
      );
    });

    it("performs a lateral ASSISTANT → BOARDING change without the HOMEROOM check", async () => {
      mockClassRepository.findById.mockResolvedValue(
        createMockClass(classId, campusId),
      );
      mockClassStaffRepository.findByPair.mockResolvedValue(
        createMockAssignment(classId, staffId, ClassStaffRole.ASSISTANT),
      );

      const result = await useCase.execute(
        { campusId, classId, staffId, newRole: ClassStaffRole.BOARDING },
        actor,
      );

      expect(result.role).toBe(ClassStaffRole.BOARDING);
      expect(
        mockClassStaffRepository.findHomeroomByClassId,
      ).not.toHaveBeenCalled();
      expect(mockTx.recordAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.objectContaining({
            previousRole: ClassStaffRole.ASSISTANT,
            newRole: ClassStaffRole.BOARDING,
          }),
        }),
      );
    });
  });

  describe("No-op same role (Scenario 6)", () => {
    it("returns the existing entity when newRole === existing.role; no DB write, no audit, no UoW invocation", async () => {
      const existing = createMockAssignment(
        classId,
        staffId,
        ClassStaffRole.ASSISTANT,
      );

      mockClassRepository.findById.mockResolvedValue(
        createMockClass(classId, campusId),
      );
      mockClassStaffRepository.findByPair.mockResolvedValue(existing);

      const result = await useCase.execute(
        { campusId, classId, staffId, newRole: ClassStaffRole.ASSISTANT },
        actor,
      );

      // Strict identity — the same entity reference flows back to the caller.
      expect(result).toBe(existing);

      expect(
        mockClassStaffRepository.findHomeroomByClassId,
      ).not.toHaveBeenCalled();
      expect(unitOfWork.run).not.toHaveBeenCalled();
      expect(mockTx.updateClassStaff).not.toHaveBeenCalled();
      expect(mockTx.recordAudit).not.toHaveBeenCalled();
    });
  });

  describe("HOMEROOM uniqueness invariant (Scenario 5)", () => {
    it("throws ConflictException with HOMEROOM_ALREADY_ASSIGNED when promoting to HOMEROOM while another HOMEROOM exists", async () => {
      const existingHomeroom = createMockAssignment(
        classId,
        "other-staff",
        ClassStaffRole.HOMEROOM,
      );

      mockClassRepository.findById.mockResolvedValue(
        createMockClass(classId, campusId),
      );
      mockClassStaffRepository.findByPair.mockResolvedValue(
        createMockAssignment(classId, staffId, ClassStaffRole.ASSISTANT),
      );
      mockClassStaffRepository.findHomeroomByClassId.mockResolvedValue(
        existingHomeroom,
      );

      await expect(
        useCase.execute(
          { campusId, classId, staffId, newRole: ClassStaffRole.HOMEROOM },
          actor,
        ),
      ).rejects.toThrow(
        new ConflictException(ClassStaffErrorCode.HOMEROOM_ALREADY_ASSIGNED),
      );

      expect(unitOfWork.run).not.toHaveBeenCalled();
      expect(mockTx.updateClassStaff).not.toHaveBeenCalled();
      expect(mockTx.recordAudit).not.toHaveBeenCalled();
    });
  });

  describe("Class validation", () => {
    it("throws NotFoundException when the class does not exist", async () => {
      mockClassRepository.findById.mockResolvedValue(null);

      await expect(
        useCase.execute(
          { campusId, classId, staffId, newRole: ClassStaffRole.HOMEROOM },
          actor,
        ),
      ).rejects.toThrow(NotFoundException);

      expect(mockClassStaffRepository.findByPair).not.toHaveBeenCalled();
      expect(unitOfWork.run).not.toHaveBeenCalled();
    });

    it("throws BadRequestException when the class belongs to a different campus", async () => {
      mockClassRepository.findById.mockResolvedValue(
        createMockClass(classId, otherCampusId),
      );

      await expect(
        useCase.execute(
          { campusId, classId, staffId, newRole: ClassStaffRole.HOMEROOM },
          actor,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(mockClassStaffRepository.findByPair).not.toHaveBeenCalled();
      expect(unitOfWork.run).not.toHaveBeenCalled();
    });
  });

  describe("Assignment validation", () => {
    it("throws NotFoundException with STAFF_NOT_FOUND_IN_CLASS when the assignment does not exist", async () => {
      mockClassRepository.findById.mockResolvedValue(
        createMockClass(classId, campusId),
      );
      mockClassStaffRepository.findByPair.mockResolvedValue(null);

      await expect(
        useCase.execute(
          { campusId, classId, staffId, newRole: ClassStaffRole.HOMEROOM },
          actor,
        ),
      ).rejects.toThrow(
        new NotFoundException(ClassStaffErrorCode.STAFF_NOT_FOUND_IN_CLASS),
      );

      expect(unitOfWork.run).not.toHaveBeenCalled();
    });
  });
});
