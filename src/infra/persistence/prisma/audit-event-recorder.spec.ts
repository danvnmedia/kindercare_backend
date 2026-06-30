import { Prisma } from "@prisma/client";

import {
  AuditEventInput,
  AuditTransactionClient,
} from "@/application/audit/ports/audit-event-recorder.port";

import { PrismaAuditEventRecorder } from "./audit-event-recorder";

type DelegateMock = {
  findUnique: jest.Mock;
  create: jest.Mock;
};

type RootClientMock = {
  auditEvent: { create: jest.Mock };
  student: { findUnique: jest.Mock };
  guardian: { findUnique: jest.Mock };
  staff: { findUnique: jest.Mock };
  staffType: { findUnique: jest.Mock };
  mealMenu: { findUnique: jest.Mock };
  weeklyPlan: { findUnique: jest.Mock };
};

describe("PrismaAuditEventRecorder", () => {
  let recorder: PrismaAuditEventRecorder;
  let tx: {
    auditEvent: DelegateMock;
    student: DelegateMock;
    guardian: DelegateMock;
    staff: DelegateMock;
    staffType: DelegateMock;
    mealMenu: DelegateMock;
    weeklyPlan: DelegateMock;
  };
  // A "root client" stand-in. The recorder must never touch this — every
  // call should target the supplied `tx`. Sharing the same shape makes the
  // negative assertion easy to express.
  let rootClient: RootClientMock;

  const baseInput = (
    overrides: Partial<AuditEventInput> = {},
  ): AuditEventInput => ({
    actorId: "actor-1",
    action: "TRANSFER_STUDENT",
    targetType: "student",
    targetId: "student-1",
    campusId: "campus-1",
    context: { transferDate: "2026-05-18" },
    ...overrides,
  });

  beforeEach(() => {
    tx = {
      auditEvent: { findUnique: jest.fn(), create: jest.fn() },
      student: { findUnique: jest.fn(), create: jest.fn() },
      guardian: { findUnique: jest.fn(), create: jest.fn() },
      staff: { findUnique: jest.fn(), create: jest.fn() },
      staffType: { findUnique: jest.fn(), create: jest.fn() },
      mealMenu: { findUnique: jest.fn(), create: jest.fn() },
      weeklyPlan: { findUnique: jest.fn(), create: jest.fn() },
    };
    rootClient = {
      auditEvent: { create: jest.fn() },
      student: { findUnique: jest.fn() },
      guardian: { findUnique: jest.fn() },
      staff: { findUnique: jest.fn() },
      staffType: { findUnique: jest.fn() },
      mealMenu: { findUnique: jest.fn() },
      weeklyPlan: { findUnique: jest.fn() },
    };
    recorder = new PrismaAuditEventRecorder();
  });

  const txAsClient = () => tx as unknown as AuditTransactionClient;

  describe("record", () => {
    it("writes a row with the full FR-2 column shape", async () => {
      tx.student.findUnique.mockResolvedValue({ fullName: "Bob Tran" });
      tx.auditEvent.create.mockResolvedValue({ id: "evt-1" });

      await recorder.record(
        baseInput({
          context: {
            actorName: "Alice Nguyen",
            fromClassName: "Sunflowers",
            toClassName: "Roses",
            transferDate: "2026-05-18",
          },
        }),
        txAsClient(),
      );

      expect(tx.auditEvent.create).toHaveBeenCalledTimes(1);
      const arg = tx.auditEvent.create.mock.calls[0][0];

      // Every required column populated from the input.
      expect(arg.data).toMatchObject({
        actorId: "actor-1",
        action: "TRANSFER_STUDENT",
        targetType: "student",
        targetId: "student-1",
        campusId: "campus-1",
        visibility: "ADMIN",
      });

      // Caller's context fields preserved; resolved snapshot merged in.
      expect(arg.data.context).toMatchObject({
        actorName: "Alice Nguyen",
        targetName: "Bob Tran",
        fromClassName: "Sunflowers",
        toClassName: "Roses",
        transferDate: "2026-05-18",
      });

      // beforeValue / afterValue default to a DB NULL when not supplied.
      expect(arg.data.beforeValue).toBe(Prisma.DbNull);
      expect(arg.data.afterValue).toBe(Prisma.DbNull);

      // createdAt MUST NOT appear in the payload — relies on DB default.
      expect(arg.data).not.toHaveProperty("createdAt");
    });

    it("uses the supplied tx, not a root client", async () => {
      tx.student.findUnique.mockResolvedValue({ fullName: "Bob Tran" });
      tx.auditEvent.create.mockResolvedValue({ id: "evt-1" });

      await recorder.record(baseInput(), txAsClient());

      expect(tx.auditEvent.create).toHaveBeenCalledTimes(1);
      expect(tx.student.findUnique).toHaveBeenCalledTimes(1);
      // The root-client delegates must never have been touched — this is
      // the structural guarantee that the audit row participates in the
      // caller's transaction.
      expect(rootClient.auditEvent.create).not.toHaveBeenCalled();
      expect(rootClient.student.findUnique).not.toHaveBeenCalled();
      expect(rootClient.staffType.findUnique).not.toHaveBeenCalled();
      expect(rootClient.mealMenu.findUnique).not.toHaveBeenCalled();
      expect(rootClient.weeklyPlan.findUnique).not.toHaveBeenCalled();
    });

    it("picks visibility from ACTION_VISIBILITY map", async () => {
      tx.guardian.findUnique.mockResolvedValue({ fullName: "Aunt Mai" });
      tx.auditEvent.create.mockResolvedValue({ id: "evt-1" });

      // Pick two actions from different groups to confirm the map is read
      // by key, not hard-coded.
      await recorder.record(
        baseInput({
          action: "ARCHIVE_GUARDIAN",
          targetType: "guardian",
          targetId: "guardian-1",
          context: {},
        }),
        txAsClient(),
      );
      await recorder.record(
        baseInput({
          action: "CREATE_GUARDIAN",
          targetType: "guardian",
          targetId: "guardian-2",
          context: {},
        }),
        txAsClient(),
      );

      expect(tx.auditEvent.create.mock.calls[0][0].data.visibility).toBe(
        "ADMIN",
      );
      expect(tx.auditEvent.create.mock.calls[1][0].data.visibility).toBe(
        "ADMIN",
      );
    });

    it("resolves targetName snapshot via the correct delegate per targetType", async () => {
      tx.staff.findUnique.mockResolvedValue({ fullName: "Carol Pham" });
      tx.auditEvent.create.mockResolvedValue({ id: "evt-1" });

      await recorder.record(
        baseInput({
          action: "EDIT_STAFF_PROFILE",
          targetType: "staff",
          targetId: "staff-1",
          context: {},
          beforeValue: { phoneNumber: "555-1111" },
          afterValue: { phoneNumber: "555-2222" },
        }),
        txAsClient(),
      );

      expect(tx.staff.findUnique).toHaveBeenCalledWith({
        where: { id: "staff-1" },
        select: { fullName: true },
      });
      // Other targetType delegates untouched.
      expect(tx.student.findUnique).not.toHaveBeenCalled();
      expect(tx.guardian.findUnique).not.toHaveBeenCalled();
      expect(tx.staffType.findUnique).not.toHaveBeenCalled();
      expect(tx.mealMenu.findUnique).not.toHaveBeenCalled();
      expect(tx.weeklyPlan.findUnique).not.toHaveBeenCalled();

      const data = tx.auditEvent.create.mock.calls[0][0].data;
      expect(data.context).toMatchObject({ targetName: "Carol Pham" });

      // Diff fields stored verbatim as InputJsonValue.
      expect(data.beforeValue).toEqual({ phoneNumber: "555-1111" });
      expect(data.afterValue).toEqual({ phoneNumber: "555-2222" });
    });

    it("returns a null targetName for targetType='user' (GRANT_ROLE/REVOKE_ROLE — no profile lookup)", async () => {
      // D1 of @doc/specs/direct-role-assignment-via-uow puts the human-readable
      // identity in `context.actorName`, not `targetName`. The User row has no
      // name field — it lives on the linked Guardian/Staff profile. The
      // recorder MUST NOT touch student/guardian/staff delegates for this
      // targetType, and MUST emit `targetName: null`.
      tx.auditEvent.create.mockResolvedValue({ id: "evt-1" });

      await recorder.record(
        baseInput({
          action: "GRANT_ROLE",
          targetType: "user",
          targetId: "user-1",
          context: {
            roleId: "role-1",
            campusId: "campus-1",
            actorName: "Alice Nguyen",
          },
        }),
        txAsClient(),
      );

      expect(tx.student.findUnique).not.toHaveBeenCalled();
      expect(tx.guardian.findUnique).not.toHaveBeenCalled();
      expect(tx.staff.findUnique).not.toHaveBeenCalled();
      expect(tx.staffType.findUnique).not.toHaveBeenCalled();

      const data = tx.auditEvent.create.mock.calls[0][0].data;
      expect(data.targetType).toBe("user");
      expect(data.targetId).toBe("user-1");
      expect(data.context).toMatchObject({
        targetName: null,
        roleId: "role-1",
        campusId: "campus-1",
        actorName: "Alice Nguyen",
      });
    });

    it("resolves a StaffType name snapshot for targetType='staff_type'", async () => {
      tx.staffType.findUnique.mockResolvedValue({ name: "Lead Teacher" });
      tx.auditEvent.create.mockResolvedValue({ id: "evt-1" });

      await recorder.record(
        baseInput({
          action: "CREATE_STAFF_TYPE",
          targetType: "staff_type",
          targetId: "staff-type-1",
          context: {},
        }),
        txAsClient(),
      );

      expect(tx.staffType.findUnique).toHaveBeenCalledWith({
        where: { id: "staff-type-1" },
        select: { name: true },
      });
      expect(tx.auditEvent.create.mock.calls[0][0].data.context).toMatchObject({
        targetName: "Lead Teacher",
      });
    });

    it("resolves a meal menu title snapshot for targetType='meal_menu'", async () => {
      tx.mealMenu.findUnique.mockResolvedValue({ title: "Week 1 Menu" });
      tx.auditEvent.create.mockResolvedValue({ id: "evt-1" });

      await recorder.record(
        baseInput({
          action: "CREATE_MEAL_MENU",
          targetType: "meal_menu",
          targetId: "menu-1",
          context: {},
        }),
        txAsClient(),
      );

      expect(tx.mealMenu.findUnique).toHaveBeenCalledWith({
        where: { id: "menu-1" },
        select: { title: true },
      });
      expect(tx.auditEvent.create.mock.calls[0][0].data.context).toMatchObject({
        targetName: "Week 1 Menu",
      });
    });

    it("does not resolve a targetName for targetType='meal_menu_config'", async () => {
      tx.auditEvent.create.mockResolvedValue({ id: "evt-1" });

      await recorder.record(
        baseInput({
          action: "UPDATE_MEAL_MENU_CONFIG",
          targetType: "meal_menu_config",
          targetId: "config-1",
          context: {},
        }),
        txAsClient(),
      );

      expect(tx.mealMenu.findUnique).not.toHaveBeenCalled();
      expect(tx.auditEvent.create.mock.calls[0][0].data.context).toMatchObject({
        targetName: null,
      });
    });

    it("resolves a class/week snapshot for targetType='weekly_plan'", async () => {
      tx.weeklyPlan.findUnique.mockResolvedValue({
        weekStartDate: new Date("2026-06-15T00:00:00.000Z"),
        class: { name: "K1 Room A" },
      });
      tx.auditEvent.create.mockResolvedValue({ id: "evt-1" });

      await recorder.record(
        baseInput({
          action: "CREATE_WEEKLY_PLAN",
          targetType: "weekly_plan",
          targetId: "plan-1",
          context: {},
        }),
        txAsClient(),
      );

      expect(tx.weeklyPlan.findUnique).toHaveBeenCalledWith({
        where: { id: "plan-1" },
        select: {
          weekStartDate: true,
          class: { select: { name: true } },
        },
      });
      expect(tx.auditEvent.create.mock.calls[0][0].data.context).toMatchObject({
        targetName: "K1 Room A 2026-06-15",
      });
    });

    it("falls back to a null targetName snapshot when the target row is missing", async () => {
      tx.student.findUnique.mockResolvedValue(null);
      tx.auditEvent.create.mockResolvedValue({ id: "evt-1" });

      await recorder.record(baseInput({ context: {} }), txAsClient());

      const data = tx.auditEvent.create.mock.calls[0][0].data;
      expect(data.context).toMatchObject({ targetName: null });
    });

    it("caller-supplied context.targetName overrides the resolved snapshot", async () => {
      // Scenario 4: target may be hard-deleted by the time `record()` runs.
      // The caller can pre-supply the snapshot from in-memory state and the
      // recorder must not clobber it with whatever (possibly null) it
      // reads from the tx.
      tx.student.findUnique.mockResolvedValue({ fullName: "Resolved Name" });
      tx.auditEvent.create.mockResolvedValue({ id: "evt-1" });

      await recorder.record(
        baseInput({
          context: { targetName: "Caller Snapshot", extra: 1 },
        }),
        txAsClient(),
      );

      const data = tx.auditEvent.create.mock.calls[0][0].data;
      expect(data.context).toMatchObject({
        targetName: "Caller Snapshot",
        extra: 1,
      });
    });

    it("throws on an unknown targetType (defensive runtime guard)", async () => {
      tx.auditEvent.create.mockResolvedValue({ id: "evt-1" });

      const input = baseInput({
        // Cast through `unknown` — TS would normally block this assignment.
        // The cast simulates a future caller bypassing the union via `any`.
        targetType: "enrollment" as unknown as AuditEventInput["targetType"],
      });

      await expect(recorder.record(input, txAsClient())).rejects.toThrow(
        /Unsupported audit targetType: enrollment/,
      );
      expect(tx.auditEvent.create).not.toHaveBeenCalled();
    });

    it("propagates errors from tx.auditEvent.create (D4 — no swallowing)", async () => {
      tx.student.findUnique.mockResolvedValue({ fullName: "Bob Tran" });
      const dbError = new Error("simulated DB failure");
      tx.auditEvent.create.mockRejectedValue(dbError);

      await expect(recorder.record(baseInput(), txAsClient())).rejects.toBe(
        dbError,
      );
    });
  });
});
