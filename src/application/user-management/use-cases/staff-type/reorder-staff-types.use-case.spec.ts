import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import {
  TransactionContext,
  UnitOfWorkPort,
} from "@/application/ports/unit-of-work.port";
import { ReorderStaffTypesUseCase } from "./reorder-staff-types.use-case";
import { StaffTypeRepository } from "../../ports/staff-type.repository";
import { StaffType } from "@/domain/user-management/entities/staff-type.entity";
import { User } from "@/domain/user-management/user.entity";

describe("ReorderStaffTypesUseCase", () => {
  let useCase: ReorderStaffTypesUseCase;
  let mockRepository: jest.Mocked<StaffTypeRepository>;
  let mockTx: jest.Mocked<TransactionContext>;
  let unitOfWork: jest.Mocked<UnitOfWorkPort>;
  let actor: User;

  const campusId = "campus-123";
  const otherCampusId = "campus-other";

  const createMockStaffType = (
    id: string,
    name: string,
    campusIdOverride: string = campusId,
    order: number = 1,
  ): StaffType => {
    return StaffType.create(
      {
        campusId: campusIdOverride,
        name,
        order,
      },
      id,
    );
  };

  const createActor = (): User =>
    User.reconstitute(
      {
        clerkUid: "user_stafftypeactor",
        isActive: true,
        profile: {
          type: "staff",
          id: "actor-profile-1",
          fullName: "Alice Nguyen",
          email: null,
          phoneNumber: null,
          dateOfBirth: null,
          gender: null,
        },
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      "actor-1",
    );

  beforeEach(async () => {
    mockRepository = {
      findById: jest.fn(),
      findByName: jest.fn(),
      findByOrderAndCampus: jest.fn(),
      findByCampusId: jest.fn(),
      findAll: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      exists: jest.fn(),
      existsAndNotArchived: jest.fn(),
      getMaxOrder: jest.fn(),
      reorder: jest.fn(),
    } as jest.Mocked<StaffTypeRepository>;
    mockTx = {
      reorderStaffTypes: jest.fn(),
      recordAudit: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<TransactionContext>;
    unitOfWork = {
      run: jest.fn((task) => task(mockTx)),
    } as unknown as jest.Mocked<UnitOfWorkPort>;
    actor = createActor();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReorderStaffTypesUseCase,
        {
          provide: "STAFF_TYPE_REPOSITORY",
          useValue: mockRepository,
        },
        {
          provide: UnitOfWorkPort,
          useValue: unitOfWork,
        },
      ],
    }).compile();

    useCase = module.get<ReorderStaffTypesUseCase>(ReorderStaffTypesUseCase);
  });

  describe("execute", () => {
    it("should reorder staff types successfully", async () => {
      const staffType1 = createMockStaffType("id-1", "Teacher", campusId, 1);
      const staffType2 = createMockStaffType("id-2", "Assistant", campusId, 2);
      const staffType3 = createMockStaffType("id-3", "Aide", campusId, 3);

      mockRepository.findById
        .mockResolvedValueOnce(staffType1)
        .mockResolvedValueOnce(staffType2)
        .mockResolvedValueOnce(staffType3);

      const reorderedTypes = [
        createMockStaffType("id-3", "Aide", campusId, 1),
        createMockStaffType("id-1", "Teacher", campusId, 2),
        createMockStaffType("id-2", "Assistant", campusId, 3),
      ];
      mockTx.reorderStaffTypes.mockResolvedValue(reorderedTypes);

      const result = await useCase.execute(
        {
          campusId,
          ids: ["id-3", "id-1", "id-2"],
        },
        actor,
      );

      expect(result).toEqual(reorderedTypes);
      expect(mockTx.reorderStaffTypes).toHaveBeenCalledWith(campusId, [
        "id-3",
        "id-1",
        "id-2",
      ]);
      expect(mockTx.recordAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: "actor-1",
          action: "REORDER_STAFF_TYPES",
          targetType: "staff_type",
          targetId: "id-3",
          campusId,
          beforeValue: expect.objectContaining({
            ids: ["id-1", "id-2", "id-3"],
          }),
          afterValue: expect.objectContaining({
            ids: ["id-3", "id-1", "id-2"],
          }),
        }),
      );
    });

    it("should handle single item reorder", async () => {
      const staffType1 = createMockStaffType("id-1", "Teacher", campusId, 1);

      mockRepository.findById.mockResolvedValueOnce(staffType1);
      mockTx.reorderStaffTypes.mockResolvedValue([staffType1]);

      const result = await useCase.execute(
        {
          campusId,
          ids: ["id-1"],
        },
        actor,
      );

      expect(result).toHaveLength(1);
      expect(mockTx.reorderStaffTypes).toHaveBeenCalledWith(campusId, ["id-1"]);
    });

    it("should throw NotFoundException when staff type belongs to different campus", async () => {
      const staffType1 = createMockStaffType("id-1", "Teacher", campusId, 1);
      const staffTypeOtherCampus = createMockStaffType(
        "id-2",
        "Other",
        otherCampusId,
        1,
      );

      mockRepository.findById
        .mockResolvedValueOnce(staffType1)
        .mockResolvedValueOnce(staffTypeOtherCampus);

      await expect(
        useCase.execute(
          {
            campusId,
            ids: ["id-1", "id-2"],
          },
          actor,
        ),
      ).rejects.toThrow(
        new NotFoundException(
          "Staff type with ID id-2 not found in this campus",
        ),
      );
    });

    it("should throw BadRequestException when ID does not exist", async () => {
      mockRepository.findById.mockResolvedValueOnce(null);

      await expect(
        useCase.execute(
          {
            campusId,
            ids: ["non-existent-id"],
          },
          actor,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        useCase.execute(
          {
            campusId,
            ids: ["non-existent-id"],
          },
          actor,
        ),
      ).rejects.toThrow("Staff type(s) not found: non-existent-id");
    });

    it("should collect all missing IDs before throwing", async () => {
      mockRepository.findById
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      await expect(
        useCase.execute(
          {
            campusId,
            ids: ["missing-1", "missing-2", "missing-3"],
          },
          actor,
        ),
      ).rejects.toThrow(
        "Staff type(s) not found: missing-1, missing-2, missing-3",
      );
    });

    it("should validate campus isolation - cross-campus security", async () => {
      // Staff type exists but belongs to different campus
      // Should return 404 for security (don't reveal it exists in another campus)
      const staffTypeOtherCampus = createMockStaffType(
        "id-secret",
        "Secret",
        otherCampusId,
        1,
      );

      mockRepository.findById.mockResolvedValueOnce(staffTypeOtherCampus);

      await expect(
        useCase.execute(
          {
            campusId,
            ids: ["id-secret"],
          },
          actor,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it("should not call reorder or audit if validation fails", async () => {
      mockRepository.findById.mockResolvedValueOnce(null);

      await expect(
        useCase.execute(
          {
            campusId,
            ids: ["non-existent-id"],
          },
          actor,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(unitOfWork.run).not.toHaveBeenCalled();
      expect(mockTx.reorderStaffTypes).not.toHaveBeenCalled();
      expect(mockTx.recordAudit).not.toHaveBeenCalled();
    });

    it("should reject duplicate IDs before opening the UoW", async () => {
      await expect(
        useCase.execute(
          {
            campusId,
            ids: ["id-1", "id-1"],
          },
          actor,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(mockRepository.findById).not.toHaveBeenCalled();
      expect(unitOfWork.run).not.toHaveBeenCalled();
    });
  });
});
