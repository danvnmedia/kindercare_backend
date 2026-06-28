import { GetAllCampusesUseCase } from "./get-all-campuses.use-case";
import { CampusRepository } from "../ports/campus.repository";
import { Campus } from "@/domain/campus/entities/campus.entity";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";

describe("GetAllCampusesUseCase", () => {
  let useCase: GetAllCampusesUseCase;
  let mockCampusRepository: jest.Mocked<CampusRepository>;

  // Helper to create mock campuses
  const createMockCampus = (id: string, name: string): Campus => {
    return Campus.create({ name, isArchived: true }, id);
  };

  // Helper to create paginated result
  const createPaginatedResult = (
    campuses: Campus[],
    overrides?: Partial<PaginatedResult<Campus>["pagination"]>,
  ): PaginatedResult<Campus> => ({
    data: campuses,
    pagination: {
      count: overrides?.count ?? campuses.length,
      limit: overrides?.limit ?? 10,
      offset: overrides?.offset ?? 0,
      totalPages: overrides?.totalPages ?? 1,
      currentPage: overrides?.currentPage ?? 1,
      hasNext: overrides?.hasNext ?? false,
      hasPrev: overrides?.hasPrev ?? false,
    },
  });

  beforeEach(() => {
    mockCampusRepository = {
      findById: jest.fn(),
      findByName: jest.fn(),
      findAll: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      exists: jest.fn(),
    } as jest.Mocked<CampusRepository>;

    useCase = new GetAllCampusesUseCase(mockCampusRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("Global Access (accessibleCampusIds = null)", () => {
    it("should return all campuses when user has global access", async () => {
      const allCampuses = [
        createMockCampus("campus-1", "Campus A"),
        createMockCampus("campus-2", "Campus B"),
        createMockCampus("campus-3", "Campus C"),
      ];

      mockCampusRepository.findAll.mockResolvedValue(
        createPaginatedResult(allCampuses),
      );

      const result = await useCase.execute({
        accessibleCampusIds: null,
        params: { limit: 10, offset: 0 },
      });

      expect(result.data).toHaveLength(3);
      expect(mockCampusRepository.findAll).toHaveBeenCalledWith({
        limit: 10,
        offset: 0,
      });
    });

    it("should pass through existing filters when user has global access", async () => {
      mockCampusRepository.findAll.mockResolvedValue(
        createPaginatedResult([createMockCampus("campus-1", "Test Campus")]),
      );

      const filterJson = JSON.stringify({ name: { contains: "Test" } });

      await useCase.execute({
        accessibleCampusIds: null,
        params: { limit: 10, offset: 0, filter: filterJson },
      });

      expect(mockCampusRepository.findAll).toHaveBeenCalledWith({
        limit: 10,
        offset: 0,
        filter: filterJson,
      });
    });

    it("should handle pagination correctly for global access", async () => {
      mockCampusRepository.findAll.mockResolvedValue(
        createPaginatedResult([createMockCampus("campus-3", "Campus C")], {
          count: 25,
          currentPage: 3,
          totalPages: 3,
          offset: 20,
          hasNext: false,
          hasPrev: true,
        }),
      );

      const result = await useCase.execute({
        accessibleCampusIds: null,
        params: { limit: 10, offset: 20 },
      });

      expect(result.pagination.currentPage).toBe(3);
      expect(result.pagination.count).toBe(25);
      expect(mockCampusRepository.findAll).toHaveBeenCalledWith({
        limit: 10,
        offset: 20,
      });
    });
  });

  describe("No Access (accessibleCampusIds = [])", () => {
    it("should return empty array when user has no role assignments", async () => {
      const result = await useCase.execute({
        accessibleCampusIds: [],
        params: { limit: 10, offset: 0 },
      });

      expect(result.data).toEqual([]);
      expect(result.pagination.count).toBe(0);
      expect(result.pagination.totalPages).toBe(0);
      expect(mockCampusRepository.findAll).not.toHaveBeenCalled();
    });

    it("should return correct pagination structure for empty result", async () => {
      const result = await useCase.execute({
        accessibleCampusIds: [],
        params: { limit: 25, offset: 0 },
      });

      expect(result.pagination).toEqual({
        count: 0,
        limit: 25,
        offset: 0,
        totalPages: 0,
        currentPage: 1,
        hasNext: false,
        hasPrev: false,
      });
    });

    it("should use default limit when not provided", async () => {
      const result = await useCase.execute({
        accessibleCampusIds: [],
        params: {},
      });

      expect(result.pagination.limit).toBe(10);
    });
  });

  describe("Campus-Scoped Access (accessibleCampusIds = [...])", () => {
    it("should filter by accessible campus IDs", async () => {
      const accessibleCampuses = [
        createMockCampus("campus-1", "Campus A"),
        createMockCampus("campus-2", "Campus B"),
      ];

      mockCampusRepository.findAll.mockResolvedValue(
        createPaginatedResult(accessibleCampuses),
      );

      const result = await useCase.execute({
        accessibleCampusIds: ["campus-1", "campus-2"],
        params: { limit: 10, offset: 0 },
      });

      expect(result.data).toHaveLength(2);

      // Verify the scope was passed with 'in' operator
      const [calledParams, calledScope] =
        mockCampusRepository.findAll.mock.calls[0];
      expect(calledParams).toEqual({ limit: 10, offset: 0 });
      expect(calledScope).toEqual({ id: { in: ["campus-1", "campus-2"] } });
    });

    it("should combine existing filters with campus ID filter", async () => {
      mockCampusRepository.findAll.mockResolvedValue(
        createPaginatedResult([createMockCampus("campus-1", "Active Campus")]),
      );

      const existingFilter = JSON.stringify({
        isArchived: { eq: true },
        name: { contains: "Active" },
      });

      await useCase.execute({
        accessibleCampusIds: ["campus-1", "campus-2"],
        params: { limit: 10, offset: 0, filter: existingFilter },
      });

      const [calledParams, calledScope] =
        mockCampusRepository.findAll.mock.calls[0];

      // Params should preserve existing filter
      expect(calledParams.filter).toBe(existingFilter);
      // Scope should contain campus ID filter (applied separately)
      expect(calledScope).toEqual({ id: { in: ["campus-1", "campus-2"] } });
    });

    it("should handle single campus access correctly", async () => {
      mockCampusRepository.findAll.mockResolvedValue(
        createPaginatedResult([createMockCampus("campus-1", "My Campus")]),
      );

      await useCase.execute({
        accessibleCampusIds: ["campus-1"],
        params: { limit: 10, offset: 0 },
      });

      const [, calledScope] = mockCampusRepository.findAll.mock.calls[0];
      expect(calledScope).toEqual({ id: { in: ["campus-1"] } });
    });

    it("should handle pagination with campus-scoped access", async () => {
      mockCampusRepository.findAll.mockResolvedValue(
        createPaginatedResult([createMockCampus("campus-2", "Campus B")], {
          count: 15,
          currentPage: 2,
          totalPages: 2,
          offset: 10,
          hasNext: false,
          hasPrev: true,
        }),
      );

      const result = await useCase.execute({
        accessibleCampusIds: ["campus-1", "campus-2", "campus-3"],
        params: { limit: 10, offset: 10 },
      });

      expect(result.pagination.currentPage).toBe(2);
      expect(result.pagination.count).toBe(15);

      const calledParams = mockCampusRepository.findAll.mock.calls[0][0];
      expect(calledParams.offset).toBe(10);
      expect(calledParams.limit).toBe(10);
    });

    it("should handle invalid existing filter JSON gracefully", async () => {
      mockCampusRepository.findAll.mockResolvedValue(
        createPaginatedResult([createMockCampus("campus-1", "Campus A")]),
      );

      // Invalid JSON filter passed through to params (repository/query service handles it)
      await useCase.execute({
        accessibleCampusIds: ["campus-1"],
        params: { limit: 10, offset: 0, filter: "invalid-json{" },
      });

      const [calledParams, calledScope] =
        mockCampusRepository.findAll.mock.calls[0];

      // Params passed through unchanged (query service handles invalid filter)
      expect(calledParams.filter).toBe("invalid-json{");
      // Scope should still have the campus filter
      expect(calledScope).toEqual({ id: { in: ["campus-1"] } });
    });

    it("should preserve sorting parameters with campus-scoped access", async () => {
      mockCampusRepository.findAll.mockResolvedValue(
        createPaginatedResult([
          createMockCampus("campus-1", "Alpha Campus"),
          createMockCampus("campus-2", "Beta Campus"),
        ]),
      );

      await useCase.execute({
        accessibleCampusIds: ["campus-1", "campus-2"],
        params: {
          limit: 10,
          offset: 0,
          sort: "name", // Sort format: prefix with - for desc (e.g., "-name")
        },
      });

      const calledParams = mockCampusRepository.findAll.mock.calls[0][0];
      expect(calledParams.sort).toBe("name");
    });
  });

  describe("Edge Cases", () => {
    it("should handle many accessible campuses efficiently", async () => {
      const manyCampusIds = Array.from({ length: 50 }, (_, i) => `campus-${i}`);

      mockCampusRepository.findAll.mockResolvedValue(
        createPaginatedResult([createMockCampus("campus-0", "Campus 0")]),
      );

      await useCase.execute({
        accessibleCampusIds: manyCampusIds,
        params: { limit: 10, offset: 0 },
      });

      const [, calledScope] = mockCampusRepository.findAll.mock.calls[0];
      expect(calledScope?.id?.in).toHaveLength(50);
    });

    it("should handle empty repository result for campus-scoped access", async () => {
      mockCampusRepository.findAll.mockResolvedValue(
        createPaginatedResult([], { count: 0, totalPages: 0 }),
      );

      const result = await useCase.execute({
        accessibleCampusIds: ["campus-1"],
        params: { limit: 10, offset: 0 },
      });

      expect(result.data).toEqual([]);
      expect(result.pagination.count).toBe(0);
    });

    it("should not mutate the original params object", async () => {
      mockCampusRepository.findAll.mockResolvedValue(createPaginatedResult([]));

      const originalParams = { limit: 10, offset: 0 };
      const paramsCopy = { ...originalParams };

      await useCase.execute({
        accessibleCampusIds: ["campus-1"],
        params: originalParams,
      });

      expect(originalParams).toEqual(paramsCopy);
    });
  });
});
