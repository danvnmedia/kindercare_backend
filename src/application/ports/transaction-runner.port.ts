import { Prisma } from "@prisma/client";

/**
 * AppTransactionClient — the raw Prisma transaction client surface exposed
 * through `TransactionRunnerPort`.
 *
 * Aliasing keeps the Prisma type leak confined to a single line at the port
 * boundary (mirrors `AuditTransactionClient` on @doc/specs/admin-audit-log's
 * implementation seam). The application layer never references `Prisma.*`
 * elsewhere — use cases reference only this alias.
 */
export type AppTransactionClient = Prisma.TransactionClient;

/**
 * TransactionRunnerPort — single-purpose seam for "run this closure inside a
 * single DB transaction; hand back the raw transactional client".
 *
 * Why a SEPARATE port from `UnitOfWorkPort`:
 *  - `UnitOfWorkPort.run` returns a typed `TransactionContext` (user-mgmt
 *    `createUser` / `assignRoles` / etc.) — deliberately narrow per
 *    @doc/patterns/unit-of-work-pattern.
 *  - The audit recorder (@task-9cpd5c) needs the RAW `Prisma.TransactionClient`
 *    so it can issue `tx.auditEvent.create()` and snapshot lookups against the
 *    same tx as the mutation (D4 same-tx guarantee in
 *    @doc/specs/admin-audit-log).
 *  - Widening `TransactionContext` to expose a raw Prisma tx would break the
 *    "intentionally narrow" invariant the UoW pattern depends on.
 *
 * Use cases inject this port + `AuditEventRecorderPort`, open one tx, and
 * thread the same `tx` to both the repository write and the recorder call.
 *
 * @example
 * ```ts
 * await this.transactionRunner.run(async (tx) => {
 *   const persisted = await this.enrollmentRepository.save(entity, tx);
 *   await this.recorder.record({ ...auditInput }, tx);
 *   return persisted;
 * });
 * ```
 */
export abstract class TransactionRunnerPort {
  abstract run<T>(task: (tx: AppTransactionClient) => Promise<T>): Promise<T>;
}
