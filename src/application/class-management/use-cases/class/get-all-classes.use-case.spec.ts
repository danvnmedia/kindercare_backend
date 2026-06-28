import {
  GetAllClassesUseCase,
  GetAllClassesInput,
} from "./get-all-classes.use-case";
import {
  ClassListItemView,
  ClassRepository,
} from "../../ports/class.repository";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { ClassStaffRole } from "@/domain/class-management/enums/class-staff-role.enum";
import { createMockClassRepository } from "@/test-utils/mock-repository-factory";
import { DEFAULT_CAMPUS_ID_A } from "@/test-utils/entity-factories";

describe("GetAllClassesUseCase", () => {
  let useCase: GetAllClassesUseCase;
  let mockClassRepository: jest.Mocked<ClassRepository>;

  const campusId = DEFAULT_CAMPUS_ID_A;

  const makeParams = (
    overrides: Partial<StandardRequest> = {},
  ): StandardRequest =>
    ({
      limit: 10,
      offset: 0,
      ...overrides,
    }) as StandardRequest;

  const makeRow = (
    overrides: Partial<ClassListItemView> = {},
  ): ClassListItemView => ({
    id: overrides.id ?? "class-1",
    name: overrides.name ?? "Lớp A1",
    description: overrides.description ?? null,
    campusId: overrides.campusId ?? campusId,
    gradeLevelId: overrides.gradeLevelId ?? "grade-mam",
    schoolYearId: overrides.schoolYearId ?? "sy-2025-2026",
    gradeLevel: overrides.gradeLevel ?? null,
    schoolYear: overrides.schoolYear ?? null,
    studentCount: overrides.studentCount ?? 0,
    staff: overrides.staff ?? [],
    createdAt: overrides.createdAt ?? new Date("2025-09-01T00:00:00.000Z"),
    updatedAt: overrides.updatedAt ?? new Date("2025-09-01T00:00:00.000Z"),
  });

  const wrapPaginated = (
    rows: ClassListItemView[],
    overrides: Partial<PaginatedResult<ClassListItemView>["pagination"]> = {},
  ): PaginatedResult<ClassListItemView> => ({
    data: rows,
    pagination: {
      count: overrides.count ?? rows.length,
      limit: overrides.limit ?? 10,
      offset: overrides.offset ?? 0,
      totalPages: overrides.totalPages ?? 1,
      currentPage: overrides.currentPage ?? 1,
      hasNext: overrides.hasNext ?? false,
      hasPrev: overrides.hasPrev ?? false,
    },
  });

  beforeEach(() => {
    mockClassRepository = createMockClassRepository();
    useCase = new GetAllClassesUseCase(mockClassRepository);
  });

  // Scenario 1 — empty class
  it("returns studentCount=0 and staff=[] for a class with no enrollments or staff", async () => {
    const empty = makeRow({
      id: "class-empty",
      studentCount: 0,
      staff: [],
    });
    mockClassRepository.findAll.mockResolvedValue(wrapPaginated([empty]));

    const result = await useCase.execute({ campusId, params: makeParams() });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].studentCount).toBe(0);
    expect(result.data[0].staff).toEqual([]);
  });

  // Scenario 2 — mixed active + closed enrollments
  it("surfaces only active enrollments in studentCount (repo applies endDate IS NULL filter)", async () => {
    // The endDate filter is enforced inside the Prisma `_count.where` clause,
    // so at the use-case level we just verify the value flows through verbatim
    // from whatever the repo returns. The repo integration test covers the
    // SQL-level guarantee.
    const mixed = makeRow({
      id: "class-mixed",
      studentCount: 3, // 3 active, 7 closed/withdrawn excluded
    });
    mockClassRepository.findAll.mockResolvedValue(wrapPaginated([mixed]));

    const result = await useCase.execute({ campusId, params: makeParams() });

    expect(result.data[0].studentCount).toBe(3);
  });

  // Scenario 3 — all three roles, HOMEROOM first
  it("preserves staff[] ordering (HOMEROOM first, then ASSISTANT, then BOARDING) as provided by the repository", async () => {
    const fullRoster = makeRow({
      id: "class-full",
      staff: [
        {
          id: "staff-homeroom",
          fullName: "Cô Hoa (HOMEROOM)",
          role: ClassStaffRole.HOMEROOM,
        },
        {
          id: "staff-asst-1",
          fullName: "Cô Lan",
          role: ClassStaffRole.ASSISTANT,
        },
        {
          id: "staff-asst-2",
          fullName: "Cô Mai",
          role: ClassStaffRole.ASSISTANT,
        },
        {
          id: "staff-boarding",
          fullName: "Cô Thu",
          role: ClassStaffRole.BOARDING,
        },
      ],
    });
    mockClassRepository.findAll.mockResolvedValue(wrapPaginated([fullRoster]));

    const result = await useCase.execute({ campusId, params: makeParams() });

    expect(result.data[0].staff).toHaveLength(4);
    expect(result.data[0].staff[0].role).toBe(ClassStaffRole.HOMEROOM);
    expect(result.data[0].staff[1].role).toBe(ClassStaffRole.ASSISTANT);
    expect(result.data[0].staff[2].role).toBe(ClassStaffRole.ASSISTANT);
    expect(result.data[0].staff[3].role).toBe(ClassStaffRole.BOARDING);
  });

  // Scenario 4 — no HOMEROOM (the FE accepts this)
  it("accepts a staff[] with no HOMEROOM row without erroring or padding", async () => {
    const noHomeroom = makeRow({
      id: "class-no-hr",
      staff: [
        {
          id: "staff-asst",
          fullName: "Cô Lan",
          role: ClassStaffRole.ASSISTANT,
        },
        {
          id: "staff-boarding",
          fullName: "Cô Thu",
          role: ClassStaffRole.BOARDING,
        },
      ],
    });
    mockClassRepository.findAll.mockResolvedValue(wrapPaginated([noHomeroom]));

    const result = await useCase.execute({ campusId, params: makeParams() });

    expect(result.data[0].staff).toHaveLength(2);
    expect(
      result.data[0].staff.some((s) => s.role === ClassStaffRole.HOMEROOM),
    ).toBe(false);
  });

  // Scenario 5 — pagination + filter regression: params flow through unchanged
  it("forwards campusId and StandardRequest params to the repository unchanged (pagination + filter regression)", async () => {
    const params = makeParams({
      limit: 25,
      offset: 50,
      filter: '{"gradeLevelId":{"eq":"grade-mam"}}',
      sort: "-createdAt",
    });
    mockClassRepository.findAll.mockResolvedValue(
      wrapPaginated([makeRow()], {
        count: 100,
        limit: 25,
        offset: 50,
        totalPages: 4,
        currentPage: 3,
        hasNext: true,
        hasPrev: true,
      }),
    );

    const result = await useCase.execute({ campusId, params });

    expect(mockClassRepository.findAll).toHaveBeenCalledWith(campusId, params);
    expect(result.pagination.currentPage).toBe(3);
    expect(result.pagination.limit).toBe(25);
    expect(result.pagination.totalPages).toBe(4);
    expect(result.pagination.hasNext).toBe(true);
    expect(result.pagination.hasPrev).toBe(true);
  });

  it("propagates repository errors without swallowing them", async () => {
    const boom = new Error("db connection lost");
    mockClassRepository.findAll.mockRejectedValue(boom);

    await expect(
      useCase.execute({ campusId, params: makeParams() } as GetAllClassesInput),
    ).rejects.toThrow("db connection lost");
  });
});
