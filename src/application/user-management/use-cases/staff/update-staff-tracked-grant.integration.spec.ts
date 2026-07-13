/**
 * Staff-type swap atomicity — integration coverage for
 * @doc/specs/staff-multi-type-refactor §Scenario 8 (and the legacy
 * @doc/specs/tracked-grant-revocation AC-15 it supersedes).
 *
 * What this locks down: when the role-mutation step inside the UoW throws
 * mid-swap, the whole transaction closure aborts — so the staff write, the
 * join-table swap, the provenance revoke, and the audit row all roll back
 * at the DB layer.
 *
 * Sibling coverage:
 *   - `audit-atomicity.integration.spec.ts` covers the `recordAudit`-throws
 *     variant of this invariant.
 *   - This file covers the `tx.assignRoles`-throws variant — the specific
 *     failure point Scenario 8 calls out, where a real PG would raise on
 *     the new `(userId, roleId, campusId, grantedViaStaffTypeId)` insert
 *     (e.g. FK violation, deadlock, unique-constraint anomaly).
 *
 * Pattern mirrors the audit-atomicity suite: stub the UoW's `run` to invoke
 * the closure synchronously against a fake `tx`, force the failing op to
 * throw, then assert (a) the use case rejects, (b) every op preceding the
 * throw ran inside the same closure that ultimately aborted, and (c)
 * `tx.recordAudit` did NOT run.
 */

import { UpdateStaffUseCase } from "./update-staff.use-case";
import { StaffTypeRepository } from "../../ports/staff-type.repository";
import {
  TransactionContext,
  UnitOfWorkPort,
} from "@/application/ports/unit-of-work.port";
import { User } from "@/domain/user-management/user.entity";
import { createStaff, createMockStaffRepository } from "@/test-utils";

const ACTOR_ID = "actor-1";
const CAMPUS_ID = "11111111-1111-4111-a111-111111111111";
const USER_ID = "user-1";

const TYPE_OLD = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const TYPE_NEW = "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb";
const ROLE_OLD = "role-old";
const ROLE_NEW = "role-new";

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

describe("UpdateStaffUseCase — staff-type swap atomicity (Scenario 8)", () => {
  it("assignRoles failure inside the UoW propagates and the staff write + join swap + revoke ran in the same closure (audit did not)", async () => {
    const staffRepo = createMockStaffRepository();
    staffRepo.findById.mockResolvedValue(
      createStaff({
        id: "staff-1",
        campusId: CAMPUS_ID,
        userId: USER_ID,
        staffTypes: [{ id: TYPE_OLD, name: "Old" }],
      }),
    );

    const staffTypeRepo = {
      findById: jest.fn().mockImplementation((id: string) =>
        Promise.resolve(
          (id === TYPE_OLD
            ? {
                id: TYPE_OLD,
                name: "Old",
                campusId: CAMPUS_ID,
                isArchived: false,
                defaultRoleId: ROLE_OLD,
              }
            : {
                id: TYPE_NEW,
                name: "New",
                campusId: CAMPUS_ID,
                isArchived: false,
                defaultRoleId: ROLE_NEW,
              }) as never,
        ),
      ),
    } as unknown as jest.Mocked<StaffTypeRepository>;

    const ROLE_ERROR = new Error("assignRoles failure (rollback probe)");

    const updateStaffSpy = jest.fn().mockResolvedValue({ id: "staff-1" });
    const replaceStaffTypesSpy = jest.fn().mockResolvedValue(undefined);
    const revokeSpy = jest.fn().mockResolvedValue(0);
    const assignSpy = jest.fn().mockRejectedValue(ROLE_ERROR);
    const recordAuditSpy = jest.fn().mockResolvedValue(undefined);
    const mockTx = {
      updateStaff: updateStaffSpy,
      replaceStaffTypes: replaceStaffTypesSpy,
      revokeRolesByProvenance: revokeSpy,
      assignRoles: assignSpy,
      recordAudit: recordAuditSpy,
    } as unknown as TransactionContext;

    const runSpy = jest.fn(
      (task: (tx: TransactionContext) => Promise<unknown>) => task(mockTx),
    );
    const unitOfWork = { run: runSpy } as unknown as UnitOfWorkPort;

    const useCase = new UpdateStaffUseCase(
      staffRepo,
      staffTypeRepo,
      unitOfWork,
    );

    await expect(
      useCase.execute(
        "staff-1",
        { campusId: CAMPUS_ID, staffTypeIds: [TYPE_NEW] },
        buildActor(),
      ),
    ).rejects.toThrow(ROLE_ERROR.message);

    // The UoW closure was entered exactly once.
    expect(runSpy).toHaveBeenCalledTimes(1);
    // The staff scalar write was issued inside the closure.
    expect(updateStaffSpy).toHaveBeenCalledTimes(1);
    // The join-table swap ran (precedes role mutations in the helper).
    expect(replaceStaffTypesSpy).toHaveBeenCalledWith("staff-1", [TYPE_NEW]);
    // The revoke step ran (precedes assign in the helper).
    expect(revokeSpy).toHaveBeenCalledWith(USER_ID, [TYPE_OLD]);
    // The failure point.
    expect(assignSpy).toHaveBeenCalledTimes(1);
    // Audit never reached — anything after `assignRoles` in the closure was
    // skipped because the throw propagated.
    expect(recordAuditSpy).not.toHaveBeenCalled();
  });
});
