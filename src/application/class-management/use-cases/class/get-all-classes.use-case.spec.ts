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
  const referenceDate = new Date("2026-07-11T23:59:59.999Z");

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
    activeStudentCount: overrides.activeStudentCount ?? 0,
    upcomingStudentCount: overrides.upcomingStudentCount ?? 0,
    historicalStudentCount: overrides.historicalStudentCount ?? 0,
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
    jest.useFakeTimers().setSystemTime(referenceDate);
    mockClassRepository = createMockClassRepository();
    useCase = new GetAllClassesUseCase(mockClassRepository);
  });

  afterEach(() => jest.useRealTimers());

  // Scenario 1 — empty class
  it("returns all status counts as zero and staff=[] for an empty class", async () => {
    const empty = makeRow({
      id: "class-empty",
      staff: [],
    });
    mockClassRepository.findAll.mockResolvedValue(wrapPaginated([empty]));

    const result = await useCase.execute({ campusId, params: makeParams() });

    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      activeStudentCount: 0,
      upcomingStudentCount: 0,
      historicalStudentCount: 0,
    });
    expect(result.data[0]).not.toHaveProperty("studentCount");
    expect(result.data[0].staff).toEqual([]);
  });

  // Scenario 2 — mixed active + closed enrollments
  it("surfaces distinct active, upcoming, and closed historical counts", async () => {
    const mixed = makeRow({
      id: "class-mixed",
      activeStudentCount: 3,
      upcomingStudentCount: 4,
      historicalStudentCount: 7,
    });
    mockClassRepository.findAll.mockResolvedValue(wrapPaginated([mixed]));

    const result = await useCase.execute({ campusId, params: makeParams() });

    expect(result.data[0].activeStudentCount).toBe(3);
    expect(result.data[0].upcomingStudentCount).toBe(4);
    expect(result.data[0].historicalStudentCount).toBe(7);
    expect(result.data[0]).not.toHaveProperty("studentCount");
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

    expect(mockClassRepository.findAll).toHaveBeenCalledWith(
      campusId,
      params,
      referenceDate,
    );
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
