/**
 * Hard-delete survival — integration coverage (AC-12 / Scenario 4 of
 * @doc/specs/admin-audit-log).
 *
 * Given Bob has audit rows, when Bob is hard-deleted via
 * `DangerStudentController.destroy` → `DeleteStudentUseCase`, the audit rows
 * must remain readable AND their snapshot context must still surface "Bob"
 * (snapshot was captured at write time per D3).
 *
 * Two layers of evidence:
 *
 *   1. **Schema-level (FR-2 — bare UUIDs, no FK).** Read `prisma/schema.prisma`
 *      and assert the `AuditEvent` model has no `@relation` clauses referencing
 *      Student / Guardian / Staff / User. The integrity is enforced at write
 *      time by the application layer; the DB does NOT cascade.
 *
 *   2. **Runtime invariant.** Wire `DeleteStudentUseCase` + an in-memory audit
 *      store + `GetAuditEventsByTargetUseCase`. Seed audit rows for Bob, hard
 *      delete Bob, re-read by target, and assert (a) row count unchanged,
 *      (b) snapshot context still contains "Bob", (c) the delete use case
 *      never reached for the audit repo (it has no dependency on it — proven
 *      both by its constructor and by the audit-repo spy being un-called).
 */

import { readFileSync } from "fs";
import { join } from "path";

import { ConflictException, NotFoundException } from "@nestjs/common";

import { DeleteStudentUseCase } from "@/application/user-management/use-cases/student/delete-student.use-case";
import { GetAuditEventsByTargetUseCase } from "@/application/audit/use-cases/get-audit-events-by-target.use-case";
import { AuditEventRepository } from "@/application/audit/ports/audit-event.repository";
import { AuditEventRecorderPort } from "@/application/audit/ports/audit-event-recorder.port";
import { TransactionRunnerPort } from "@/application/ports/transaction-runner.port";
import { StudentHardDeleteGuardPort } from "@/application/user-management/ports/student-hard-delete-guard.port";
import { StudentRepository } from "@/application/user-management/ports/student.repository";
import { AuditEvent } from "@/domain/audit";
import { User } from "@/domain/user-management/user.entity";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import {
  createMockStudentRepository,
  createStudent,
  DEFAULT_CAMPUS_ID_A,
} from "@/test-utils";

const CAMPUS_ID = DEFAULT_CAMPUS_ID_A;
const BOB_ID = "33333333-3333-4333-a333-333333333333";
const ACTOR_ID = "44444444-4444-4444-a444-444444444444";

/**
 * In-memory `AuditEventRepository` impl honouring the read contract:
 *  - filters by `targetType` + `targetId` (or `actorId`)
 *  - filters by `scope.campusId` (system-enforced)
 *  - orders DESC by `createdAt`
 *  - paginates via `limit` / `offset`
 *
 * Used by both this suite (hard-delete survival) and the cross-campus
 * isolation suite. Kept private to this file to avoid premature abstraction;
 * if the cross-campus suite ends up needing identical setup, the constructor
 * pattern is small enough to copy and adapt locally.
 */
class InMemoryAuditRepo extends AuditEventRepository {
  constructor(private readonly rows: AuditEvent[]) {
    super();
  }

  async findByTarget(
    targetType: AuditEvent["targetType"],
    targetId: string,
    params: StandardRequest,
    scope: { campusId: string },
  ) {
    const matched = this.rows
      .filter(
        (r) =>
          r.targetType === targetType &&
          r.targetId === targetId &&
          r.campusId === scope.campusId,
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return paginate(matched, params);
  }

  async findByActor(
    actorId: string,
    params: StandardRequest,
    scope: { campusId: string },
  ) {
    const matched = this.rows
      .filter((r) => r.actorId === actorId && r.campusId === scope.campusId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return paginate(matched, params);
  }
}

function paginate(rows: AuditEvent[], params: StandardRequest) {
  const limit = params.limit ?? 20;
  const offset = params.offset ?? 0;
  const data = rows.slice(offset, offset + limit);
  return {
    data,
    pagination: {
      count: rows.length,
      limit,
      offset,
      totalPages: limit > 0 ? Math.ceil(rows.length / limit) : 0,
      currentPage: limit > 0 ? Math.floor(offset / limit) + 1 : 1,
      hasNext: offset + limit < rows.length,
      hasPrev: offset > 0,
    },
  };
}

function makeAuditRow(
  id: string,
  action: AuditEvent["action"],
  context: Record<string, unknown>,
  createdAt: Date,
) {
  return AuditEvent.reconstitute(
    {
      actorId: ACTOR_ID,
      action,
      targetType: "student",
      targetId: BOB_ID,
      campusId: CAMPUS_ID,
      beforeValue: null,
      afterValue: null,
      context,
      visibility: "ADMIN",
      createdAt,
    },
    id,
  );
}

describe("Audit hard-delete survival (admin-audit-log AC-12 / Scenario 4)", () => {
  describe("schema-level: no FK references from audit_event to target/actor", () => {
    it("AuditEvent model in prisma/schema.prisma has no @relation clauses", () => {
      const schemaPath = join(process.cwd(), "prisma", "schema.prisma");
      const schema = readFileSync(schemaPath, "utf8");

      // Find the `model AuditEvent { ... }` block (non-greedy).
      const blockMatch = schema.match(/model AuditEvent\s*\{([\s\S]*?)\n\}/);
      expect(blockMatch).not.toBeNull();
      const block = blockMatch![1];

      // FR-2: actor_id / target_id are bare UUIDs — no FK relation, so the
      // DB cannot cascade-delete an audit row when its target is destroyed.
      expect(block).not.toMatch(/@relation/);
      expect(block).not.toMatch(/references:/);
      expect(block).not.toMatch(/onDelete:/);
    });
  });

  describe("runtime invariant: rows survive hard delete; snapshot context unchanged", () => {
    let studentRepo: jest.Mocked<StudentRepository>;
    let auditRepo: InMemoryAuditRepo;
    let studentHardDeleteGuard: jest.Mocked<StudentHardDeleteGuardPort>;
    let transactionRunner: jest.Mocked<TransactionRunnerPort>;
    let recorder: jest.Mocked<AuditEventRecorderPort>;
    let findByTargetSpy: jest.SpyInstance;
    let findByActorSpy: jest.SpyInstance;
    let deleteStudent: DeleteStudentUseCase;
    let getAuditByTarget: GetAuditEventsByTargetUseCase;

    beforeEach(() => {
      studentRepo = createMockStudentRepository();
      studentRepo.findById.mockResolvedValue(
        createStudent({
          id: BOB_ID,
          campusId: CAMPUS_ID,
          fullName: "Bob Tran",
        }),
      );

      // Seed 3 audit rows for Bob. Snapshot context contains his name —
      // this is what D3 captures so the timeline survives target deletion.
      auditRepo = new InMemoryAuditRepo([
        makeAuditRow(
          "audit-1",
          "CREATE_STUDENT",
          { actorName: "Alice Nguyen", name: "Bob Tran", code: "STU-001" },
          new Date("2026-01-01T10:00:00Z"),
        ),
        makeAuditRow(
          "audit-2",
          "EDIT_STUDENT_PROFILE",
          { actorName: "Alice Nguyen", studentName: "Bob Tran" },
          new Date("2026-02-15T14:30:00Z"),
        ),
        makeAuditRow(
          "audit-3",
          "ARCHIVE_STUDENT",
          { actorName: "Alice Nguyen", studentName: "Bob Tran" },
          new Date("2026-03-20T09:15:00Z"),
        ),
      ]);
      findByTargetSpy = jest.spyOn(auditRepo, "findByTarget");
      findByActorSpy = jest.spyOn(auditRepo, "findByActor");

      studentHardDeleteGuard = {
        countRetainedHistoricalRecords: jest.fn().mockResolvedValue(0),
      } as unknown as jest.Mocked<StudentHardDeleteGuardPort>;
      transactionRunner = {
        run: jest.fn(async (task) => task({} as never)),
      } as unknown as jest.Mocked<TransactionRunnerPort>;
      recorder = {
        record: jest.fn(),
      } as unknown as jest.Mocked<AuditEventRecorderPort>;

      deleteStudent = new DeleteStudentUseCase(
        studentRepo,
        studentHardDeleteGuard,
        transactionRunner,
        recorder,
      );
      getAuditByTarget = new GetAuditEventsByTargetUseCase(auditRepo);
    });

    it("DeleteStudentUseCase has no dependency on AuditEventRepository readers", () => {
      // Constructor dependencies include retention/audit write ports, but not
      // AuditEventRepository, so the delete path cannot read or cascade audit
      // rows directly.
      expect(deleteStudent).toBeInstanceOf(DeleteStudentUseCase);
      expect(DeleteStudentUseCase.length).toBe(4);
    });

    it("after hard delete, audit rows remain and snapshot still names Bob", async () => {
      // Sanity: 3 rows present before delete.
      const before = await getAuditByTarget.execute({
        campusId: CAMPUS_ID,
        targetType: "student",
        targetId: BOB_ID,
        params: { limit: 20, offset: 0 },
      });
      expect(before.data).toHaveLength(3);

      // Hard delete Bob (DangerStudentController path).
      studentRepo.delete.mockResolvedValue(undefined);
      await deleteStudent.execute(BOB_ID, CAMPUS_ID);

      expect(studentRepo.delete).toHaveBeenCalledWith(BOB_ID);
      // The delete path never touched the audit repo.
      expect(findByTargetSpy).toHaveBeenCalledTimes(1); // only from the `before` read above
      expect(findByActorSpy).not.toHaveBeenCalled();

      // After delete: rows still readable, ordered DESC by createdAt.
      const after = await getAuditByTarget.execute({
        campusId: CAMPUS_ID,
        targetType: "student",
        targetId: BOB_ID,
        params: { limit: 20, offset: 0 },
      });
      expect(after.data).toHaveLength(3);
      expect(after.data.map((r) => r.id.toString())).toEqual([
        "audit-3",
        "audit-2",
        "audit-1",
      ]);

      // Snapshot context preserved (D3 — names frozen at write time).
      const contexts = after.data.map((r) => r.context);
      expect(contexts[0]).toMatchObject({ studentName: "Bob Tran" });
      expect(contexts[1]).toMatchObject({ studentName: "Bob Tran" });
      expect(contexts[2]).toMatchObject({ name: "Bob Tran" });
    });

    it("delete failure surfaces NotFoundException for cross-campus delete attempts", async () => {
      // Sanity guard: if the delete itself fails (e.g. campus mismatch), the
      // audit-survival contract still holds because no delete occurred.
      studentRepo.findById.mockResolvedValueOnce(
        createStudent({
          id: BOB_ID,
          campusId: "99999999-9999-4999-a999-999999999999",
          fullName: "Bob Tran",
        }),
      );

      await expect(deleteStudent.execute(BOB_ID, CAMPUS_ID)).rejects.toThrow(
        NotFoundException,
      );
      expect(studentRepo.delete).not.toHaveBeenCalled();

      const after = await getAuditByTarget.execute({
        campusId: CAMPUS_ID,
        targetType: "student",
        targetId: BOB_ID,
        params: { limit: 20, offset: 0 },
      });
      expect(after.data).toHaveLength(3);
    });

    it("blocks hard delete while retained historical records exist and audits the denial", async () => {
      studentHardDeleteGuard.countRetainedHistoricalRecords.mockResolvedValueOnce(
        2,
      );
      const actor = User.reconstitute(
        {
          clerkUid: "user_admin",
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

      await expect(
        deleteStudent.execute(BOB_ID, CAMPUS_ID, actor),
      ).rejects.toThrow(ConflictException);

      expect(studentRepo.delete).not.toHaveBeenCalled();
      expect(transactionRunner.run).toHaveBeenCalledTimes(1);
      expect(recorder.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "BLOCK_STUDENT_HARD_DELETE_FOR_RETENTION",
          targetType: "student",
          targetId: BOB_ID,
          campusId: CAMPUS_ID,
          context: expect.objectContaining({
            retainedHistoricalRecordCount: 2,
            workflow: "historical_retention",
          }),
        }),
        expect.anything(),
      );
    });
  });
});
