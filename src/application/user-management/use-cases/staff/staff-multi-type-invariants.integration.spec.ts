/**
 * Cross-cutting invariant lock-down for the multi-type refactor —
 * @doc/specs/staff-multi-type-refactor §Scenarios 1, 4, 6, 9.
 *
 * What this locks down (one describe per scenario):
 *
 *   - Scenario 1: `CreateStaffUseCase` with two staff types sharing the same
 *     `defaultRoleId` materializes ONE `user_roles` row per (type, role) pair
 *     — D-extra-3 per-provenance fan-out — and runs in the canonical UoW
 *     closure order: `createUser` → `createStaff` → `replaceStaffTypes` →
 *     `assignRoles(<2 entries>)` → `recordAudit("CREATE_STAFF")`.
 *
 *   - Scenario 4: `UpdateStaffUseCase` issues the tracked-provenance insert
 *     UNCONDITIONALLY when an added type carries a `defaultRoleId`. No
 *     pre-check against `UserRepository` to detect a "would-conflict with
 *     manual grant" path — D5 retirement leaves the 4-col `NULLS NOT
 *     DISTINCT` unique key as the only conflict arbiter at the DB layer
 *     (see Superseded sections in @doc/specs/tracked-grant-revocation).
 *
 *   - Scenario 6: legacy NULL-orphan staff hydration. A staff with an empty
 *     `staff_staff_type` set hydrates to `staff.staffTypes === []` via the
 *     mapper; `Staff.setStaffTypes([])` throws (min-1 invariant); a `PATCH`
 *     that omits `staffTypeIds` still succeeds on a legacy-empty entity and
 *     does NOT trigger `tx.replaceStaffTypes`.
 *
 *   - Scenario 9: filter pre-extraction. Lock-down lives in the repository
 *     suite — see `src/infra/persistence/prisma/repositories/prisma-staff.repository.spec.ts`
 *     (`describe("findAll")` — `allowedFilterFields` exclusion + pre-extraction
 *     + `staffTypes.some` relation-clause injection). A `describe.skip` block
 *     below cross-references that anchor so Scenario 9 stays discoverable
 *     from the invariants suite.
 *
 * Pattern matches the sibling integration spec
 * `staff-tracked-grant-non-propagation.integration.spec.ts`: mock-UoW + fake
 * `tx` with `jest.fn()` spies, no real Postgres harness. The closure
 * scaffolding (`unitOfWork.run = task => task(mockTx)`) lets us assert
 * exact in-tx call order and payload shapes per scenario.
 */

import { CreateStaffUseCase } from "./create-staff.use-case";
import { UpdateStaffUseCase } from "./update-staff.use-case";
import { StaffRepository } from "../../ports/staff.repository";
import { StaffTypeRepository } from "../../ports/staff-type.repository";
import { UserRepository } from "../../ports/user.repository";
import { IdentityPort } from "@/application/ports/identity.port";
import { StaffCodeGeneratorPort } from "@/application/ports/staff-code-generator.port";
import {
  TransactionContext,
  UnitOfWorkPort,
} from "@/application/ports/unit-of-work.port";
import { Staff } from "@/domain/user-management/entities/staff.entity";
import { User } from "@/domain/user-management/user.entity";
import { PrismaStaffMapper } from "@/infra/persistence/prisma/mapper/prisma-staff.mapper";
import {
  createStaff,
  createMockStaffRepository,
  createMockUserRepository,
} from "@/test-utils";

const ACTOR_ID = "actor-1";
const CAMPUS_ID = "11111111-1111-4111-a111-111111111111";

// UUID-lex-stable ids so audit `staffTypeIds: sort()` is deterministic.
const TYPE_TEACHER = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const TYPE_VICE_PRESIDENT = "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb";
const TYPE_OTHER = "cccccccc-cccc-4ccc-cccc-cccccccccccc";
const ROLE_STAFF = "role-staff-uuid";
const ROLE_X = "role-x-uuid";

function buildActor(): User {
  return User.reconstitute(
    {
      clerkUid: "user_audit12345",
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

/**
 * Build a `StaffType`-shaped fixture for `staffTypeRepository.findById`
 * mocks. Returned as `unknown` so callers cast inside `mockImplementation`
 * with `as never`; mirrors the convention in the unit specs.
 */
function stype(overrides: {
  id: string;
  name?: string;
  defaultRoleId?: string | null;
  isArchived?: boolean;
  campusId?: string;
}): unknown {
  return {
    id: overrides.id,
    campusId: overrides.campusId ?? CAMPUS_ID,
    name: overrides.name ?? `StaffType-${overrides.id}`,
    defaultRoleId:
      overrides.defaultRoleId === undefined ? null : overrides.defaultRoleId,
    isArchived: overrides.isArchived ?? false,
  };
}

describe("Staff multi-type — cross-cutting invariants (specs/staff-multi-type-refactor Scenarios 1/4/6/9)", () => {
  // -----------------------------------------------------------------
  // Scenario 1 — Create staff with two types sharing the same default role
  //              (D-extra-3 per-provenance fan-out, full closure order)
  // -----------------------------------------------------------------
  describe("Scenario 1 — CreateStaffUseCase: two types sharing defaultRoleId produce 2 tracked grants", () => {
    it("runs createUser → createStaff → replaceStaffTypes → assignRoles(<2 entries, same role, distinct provenance>) → recordAudit('CREATE_STAFF') in one closure", async () => {
      const staffRepo = createMockStaffRepository();
      staffRepo.findByEmailInCampus.mockResolvedValue(null);
      staffRepo.findByPhoneNumberInCampus.mockResolvedValue(null);

      const staffTypeRepo = {
        findById: jest.fn().mockImplementation((id: string) =>
          Promise.resolve(
            (id === TYPE_TEACHER
              ? stype({
                  id: TYPE_TEACHER,
                  name: "Teacher",
                  defaultRoleId: ROLE_STAFF,
                })
              : stype({
                  id: TYPE_VICE_PRESIDENT,
                  name: "VicePresident",
                  defaultRoleId: ROLE_STAFF,
                })) as never,
          ),
        ),
      } as unknown as jest.Mocked<StaffTypeRepository>;

      const createUserSpy = jest.fn().mockResolvedValue({
        id: "user-new",
        clerkUid: "user_new12345",
      });
      const createStaffSpy = jest
        .fn()
        .mockImplementation((data: { id: string }) =>
          Promise.resolve({ id: data.id }),
        );
      const replaceStaffTypesSpy = jest.fn().mockResolvedValue(undefined);
      const assignRolesSpy = jest.fn().mockResolvedValue(2);
      const recordAuditSpy = jest.fn().mockResolvedValue(undefined);
      const mockTx = {
        createUser: createUserSpy,
        createStaff: createStaffSpy,
        replaceStaffTypes: replaceStaffTypesSpy,
        assignRoles: assignRolesSpy,
        recordAudit: recordAuditSpy,
      } as unknown as TransactionContext;

      const unitOfWork = {
        run: jest.fn(
          (task: (tx: TransactionContext) => Promise<unknown>) => task(mockTx),
        ),
      } as unknown as UnitOfWorkPort;

      const identityPort = {
        provisionUser: jest.fn().mockResolvedValue({
          clerkUid: "user_new12345",
        }),
        deleteIdentity: jest.fn().mockResolvedValue(undefined),
      } as unknown as IdentityPort;

      const staffCodeGenerator = {
        generateNextCode: jest.fn().mockResolvedValue("ST-2026-000042"),
      } as unknown as StaffCodeGeneratorPort;

      const useCase = new CreateStaffUseCase(
        staffRepo,
        staffTypeRepo,
        unitOfWork,
        identityPort,
        staffCodeGenerator,
      );

      const result = await useCase.execute(
        {
          campusId: CAMPUS_ID,
          fullName: "Dan Le",
          email: "dan@test.com",
          phoneNumber: "+84901234567",
          staffTypeIds: [TYPE_TEACHER, TYPE_VICE_PRESIDENT],
        },
        buildActor(),
      );

      // The entity carries both staff-type snapshots — read-side projection
      // sees the multi-type set immediately after the UoW commits.
      expect(result.staffTypes).toEqual([
        { id: TYPE_TEACHER, name: "Teacher" },
        { id: TYPE_VICE_PRESIDENT, name: "VicePresident" },
      ]);

      // Closure-order assertion via `invocationCallOrder` — single source of
      // truth for "did these run in this sequence inside the same closure".
      const order = [
        createUserSpy.mock.invocationCallOrder[0],
        createStaffSpy.mock.invocationCallOrder[0],
        replaceStaffTypesSpy.mock.invocationCallOrder[0],
        assignRolesSpy.mock.invocationCallOrder[0],
        recordAuditSpy.mock.invocationCallOrder[0],
      ];
      expect(order).toEqual([...order].sort((a, b) => a - b));

      // `replaceStaffTypes` receives the full target set verbatim — order
      // preserved (caller-supplied order, not lex-sorted).
      expect(replaceStaffTypesSpy).toHaveBeenCalledWith(
        result.id,
        [TYPE_TEACHER, TYPE_VICE_PRESIDENT],
      );

      // D-extra-3 fan-out: exactly two `user_roles` inserts, same roleId,
      // distinct `grantedViaStaffTypeId` provenance. The 4-col `NULLS NOT
      // DISTINCT` unique permits this; the 3-col legacy unique would not.
      expect(assignRolesSpy).toHaveBeenCalledTimes(1);
      const [userIdArg, assignments] = assignRolesSpy.mock.calls[0]!;
      expect(userIdArg).toBe("user-new");
      expect(assignments).toHaveLength(2);
      expect(assignments).toEqual(
        expect.arrayContaining([
          {
            roleId: ROLE_STAFF,
            campusId: CAMPUS_ID,
            grantedViaStaffTypeId: TYPE_TEACHER,
          },
          {
            roleId: ROLE_STAFF,
            campusId: CAMPUS_ID,
            grantedViaStaffTypeId: TYPE_VICE_PRESIDENT,
          },
        ]),
      );

      // Audit shape unchanged from single-type create — the multi-type
      // refactor preserves CREATE_STAFF context.
      expect(recordAuditSpy).toHaveBeenCalledTimes(1);
      const auditPayload = recordAuditSpy.mock.calls[0]![0];
      expect(auditPayload.action).toBe("CREATE_STAFF");
      expect(auditPayload.targetId).toBe(result.id);
      expect(auditPayload.campusId).toBe(CAMPUS_ID);
    });
  });

  // -----------------------------------------------------------------
  // Scenario 4 — D5 retirement: tracked insert is unconditional;
  //              `UserRepository` is never read for a pre-check
  // -----------------------------------------------------------------
  describe("Scenario 4 — UpdateStaffUseCase: tracked-grant insert is unconditional (no pre-check against manual rows)", () => {
    it("issues tx.assignRoles with tracked provenance even when a manual ROLE_X 'would already exist'; no UserRepository pre-check fires", async () => {
      const staffRepo = createMockStaffRepository();
      staffRepo.findById.mockResolvedValue(
        createStaff({
          id: "staff-1",
          campusId: CAMPUS_ID,
          userId: "user-1",
          staffTypes: [{ id: TYPE_OTHER, name: "Other" }],
        }),
      );

      const staffTypeRepo = {
        findById: jest.fn().mockImplementation((id: string) =>
          Promise.resolve(
            (id === TYPE_OTHER
              ? stype({
                  id: TYPE_OTHER,
                  name: "Other",
                  defaultRoleId: null,
                })
              : stype({
                  id: TYPE_TEACHER,
                  name: "Teacher",
                  defaultRoleId: ROLE_X,
                })) as never,
          ),
        ),
      } as unknown as jest.Mocked<StaffTypeRepository>;

      const userRepo = createMockUserRepository();

      const updateStaffSpy = jest.fn().mockResolvedValue({ id: "staff-1" });
      const replaceStaffTypesSpy = jest.fn().mockResolvedValue(undefined);
      const revokeRolesByProvenanceSpy = jest.fn().mockResolvedValue(0);
      const assignRolesSpy = jest.fn().mockResolvedValue(1);
      const recordAuditSpy = jest.fn().mockResolvedValue(undefined);
      const mockTx = {
        updateStaff: updateStaffSpy,
        replaceStaffTypes: replaceStaffTypesSpy,
        revokeRolesByProvenance: revokeRolesByProvenanceSpy,
        assignRoles: assignRolesSpy,
        recordAudit: recordAuditSpy,
      } as unknown as TransactionContext;

      const unitOfWork = {
        run: jest.fn(
          (task: (tx: TransactionContext) => Promise<unknown>) => task(mockTx),
        ),
      } as unknown as UnitOfWorkPort;

      const identityPort = {
        updateUser: jest.fn().mockResolvedValue(undefined),
      } as unknown as IdentityPort;

      const useCase = new UpdateStaffUseCase(
        staffRepo,
        staffTypeRepo,
        userRepo,
        unitOfWork,
        identityPort,
      );

      // Staff has [Other]; swap-in {Other, Teacher} so Teacher.defaultRoleId
      // (= ROLE_X) drives a tracked-grant insert. In a real DB, a separate
      // manual row for (user-1, ROLE_X, CAMPUS_ID, NULL) could coexist —
      // we don't simulate it here because D5 retirement says the use case
      // does not branch on its presence. We assert that absence structurally.
      await useCase.execute(
        "staff-1",
        {
          campusId: CAMPUS_ID,
          staffTypeIds: [TYPE_OTHER, TYPE_TEACHER],
        },
        buildActor(),
      );

      // The unconditional tracked insert fired with the per-type provenance.
      expect(assignRolesSpy).toHaveBeenCalledTimes(1);
      const [userIdArg, assignments] = assignRolesSpy.mock.calls[0]!;
      expect(userIdArg).toBe("user-1");
      expect(assignments).toEqual([
        {
          roleId: ROLE_X,
          campusId: CAMPUS_ID,
          grantedViaStaffTypeId: TYPE_TEACHER,
        },
      ]);

      // Structural lock: no `UserRepository.getUserRoles*` pre-check exists
      // on the path. If a future refactor adds defensive "skip if manual
      // already holds it" logic, these assertions fail and force a spec
      // re-read against D5 retirement (Superseded sections of
      // @doc/specs/tracked-grant-revocation).
      expect(userRepo.getUserRoles).not.toHaveBeenCalled();
      expect(userRepo.getUserRolesForCampus).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------
  // Scenario 6 — Legacy NULL-orphan hydration + omit-staffTypeIds PATCH
  // -----------------------------------------------------------------
  describe("Scenario 6 — legacy NULL-orphan staff: empty staffTypes hydration + PATCH lifecycle", () => {
    it("PrismaStaffMapper.toDomain on a row with staffTypes: [] returns Staff with empty staffTypes (legacy-orphan compat)", () => {
      const prismaRow = {
        id: "staff-legacy",
        campusId: CAMPUS_ID,
        staffCode: "ST-2024-000001",
        fullName: "Legacy Staff",
        email: "legacy@test.com",
        phoneNumber: "+84900000000",
        address: null,
        dateOfBirth: null,
        gender: null,
        startDate: null,
        userId: null,
        isArchived: false,
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
        updatedAt: new Date("2024-01-01T00:00:00.000Z"),
        staffTypes: [],
        user: null,
      } as unknown as Parameters<typeof PrismaStaffMapper.toDomain>[0];

      const entity = PrismaStaffMapper.toDomain(prismaRow);

      expect(entity.staffTypes).toEqual([]);
    });

    it("Staff.setStaffTypes([]) throws — the min-1 invariant gates the entity write path", () => {
      const staff = createStaff({
        id: "staff-1",
        campusId: CAMPUS_ID,
        staffTypes: [{ id: TYPE_TEACHER, name: "Teacher" }],
      });

      expect(() => staff.setStaffTypes([])).toThrow();
    });

    it("UpdateStaffUseCase on legacy-empty staff with omitted staffTypeIds: updates scalar fields, no replaceStaffTypes / no role mutation", async () => {
      const staffRepo = createMockStaffRepository();
      staffRepo.findById.mockResolvedValue(
        createStaff({
          id: "staff-legacy",
          campusId: CAMPUS_ID,
          fullName: "Legacy Staff",
          address: "Old Address",
          userId: null,
          staffTypes: [], // legacy NULL-orphan post-migration
        }),
      );

      const staffTypeRepo = {
        findById: jest.fn(),
      } as unknown as jest.Mocked<StaffTypeRepository>;
      const userRepo = createMockUserRepository();

      const updateStaffSpy = jest
        .fn()
        .mockResolvedValue({ id: "staff-legacy" });
      const replaceStaffTypesSpy = jest.fn();
      const revokeSpy = jest.fn();
      const assignSpy = jest.fn();
      const recordAuditSpy = jest.fn().mockResolvedValue(undefined);
      const mockTx = {
        updateStaff: updateStaffSpy,
        replaceStaffTypes: replaceStaffTypesSpy,
        revokeRolesByProvenance: revokeSpy,
        assignRoles: assignSpy,
        recordAudit: recordAuditSpy,
      } as unknown as TransactionContext;

      const unitOfWork = {
        run: jest.fn(
          (task: (tx: TransactionContext) => Promise<unknown>) => task(mockTx),
        ),
      } as unknown as UnitOfWorkPort;

      const identityPort = {
        updateUser: jest.fn().mockResolvedValue(undefined),
      } as unknown as IdentityPort;

      const useCase = new UpdateStaffUseCase(
        staffRepo,
        staffTypeRepo,
        userRepo,
        unitOfWork,
        identityPort,
      );

      await useCase.execute(
        "staff-legacy",
        { campusId: CAMPUS_ID, address: "New Address" },
        buildActor(),
      );

      // Scalar update path still works on a legacy-empty entity.
      expect(updateStaffSpy).toHaveBeenCalledTimes(1);

      // No set-diff because `staffTypeIds` was omitted — `replaceStaffTypes`
      // stays untouched even though the existing set is empty (an omitted
      // field is NOT "swap to []"; it's "don't touch types").
      expect(replaceStaffTypesSpy).not.toHaveBeenCalled();
      expect(revokeSpy).not.toHaveBeenCalled();
      expect(assignSpy).not.toHaveBeenCalled();

      // The address change still emits an audit row (scalar diff present).
      expect(recordAuditSpy).toHaveBeenCalledTimes(1);
      const payload = recordAuditSpy.mock.calls[0]![0];
      expect(payload.action).toBe("EDIT_STAFF_PROFILE");
      expect(payload.beforeValue).toEqual({ address: "Old Address" });
      expect(payload.afterValue).toEqual({ address: "New Address" });
    });

    it("Staff factory accepts staffTypes: [] (legacy-orphan default) without throwing — entity hydration path stays open", () => {
      // AC-3 of @doc/specs/staff-multi-type-refactor: `Staff.create` accepts
      // empty sets for mapper hydration so legacy NULL-orphan rows can flow
      // through reads. The min-1 invariant is enforced on `setStaffTypes`,
      // not on construction.
      const legacy = createStaff({
        id: "staff-legacy",
        campusId: CAMPUS_ID,
        staffTypes: [],
      });
      expect(legacy.staffTypes).toEqual([]);
    });
  });

  // -----------------------------------------------------------------
  // Scenario 9 — Filter pre-extraction (cross-reference)
  // -----------------------------------------------------------------
  describe.skip("Scenario 9 — filter pre-extraction (locked in prisma-staff.repository.spec.ts)", () => {
    // The FR-6 invariants for `GET /staff?filter[staffTypeIds]={ in: [...] }`
    // are exhaustively covered in
    // `src/infra/persistence/prisma/repositories/prisma-staff.repository.spec.ts`
    // under `describe("findAll")`:
    //
    //   1. `staffTypeIds` is NOT in `allowedFilterFields` — the field is
    //      pre-extracted before `executeQuery`'s allow-list gate runs.
    //   2. `filterInfo.filters.staffTypeIds: { in: [...] }` is pre-extracted
    //      and removed from the envelope so the validator does not reject it.
    //   3. Raw-array shape (`staffTypeIds: ["..."]`) is treated equivalently.
    //   4. The relation clause `{ staffTypes: { some: { staffTypeId: { in:
    //      [...] } } } }` is injected into `options.where`.
    //   5. Sibling filters (e.g. `fullName`) survive the extraction untouched.
    //
    // Re-asserting the same shape at the use-case boundary here would
    // duplicate that coverage without adding signal (the use case is a
    // pass-through to `staffRepository.findAll`). This block is intentionally
    // `describe.skip` so a tools-aware reader sees the cross-reference; the
    // canonical lock lives in the repo spec.
    it("documented in prisma-staff.repository.spec.ts findAll suite", () => {
      // intentionally empty — see block comment
    });
  });
});
