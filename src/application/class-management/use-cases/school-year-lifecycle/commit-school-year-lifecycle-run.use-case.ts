import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";

import { User } from "@/domain/user-management/user.entity";

import { SchoolYearLifecycleRepository } from "../../ports/school-year-lifecycle.repository";
import { HistoricalRecordRepository } from "../../ports/historical-record.repository";
import { RunScopedSchoolYearLifecycleCommitResult } from "../../school-year-lifecycle";
import { CommitSchoolYearLifecycleUseCase } from "./commit-school-year-lifecycle.use-case";
import { resolveSchoolYearLifecycleRetention } from "./school-year-lifecycle-retention";

@Injectable()
export class CommitSchoolYearLifecycleRunUseCase {
  constructor(
    @Inject("SCHOOL_YEAR_LIFECYCLE_REPOSITORY")
    private readonly lifecycleRepository: SchoolYearLifecycleRepository,
    private readonly commitSchoolYearLifecycleUseCase: CommitSchoolYearLifecycleUseCase,
    @Optional()
    private readonly historicalRecordRepository?: HistoricalRecordRepository,
  ) {}

  async execute(
    input: {
      lifecycleRunId: string;
      campusId: string;
      previewRunId: string;
      digest: string;
    },
    currentUser: User,
  ): Promise<RunScopedSchoolYearLifecycleCommitResult> {
    const preview = await this.lifecycleRepository.findPreviewRunById(
      input.previewRunId,
      input.campusId,
    );
    if (
      !preview ||
      preview.lifecycleRunId !== input.lifecycleRunId ||
      preview.runVersion === null
    ) {
      throw new NotFoundException("PREVIEW_NOT_FOUND");
    }
    if (preview.digest !== input.digest) {
      throw new BadRequestException("DIGEST_MISMATCH");
    }
    if (preview.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException("PREVIEW_EXPIRED");
    }
    if (preview.status !== "VALID") {
      throw new BadRequestException(this.previewStatusCode(preview.status));
    }
    const memberships = await this.lifecycleRepository.findPreviewMemberships(
      preview.id,
      input.campusId,
    );
    if (memberships.length === 0) {
      throw new BadRequestException("INVALID_SCOPE");
    }
    const retention = await resolveSchoolYearLifecycleRetention(
      this.historicalRecordRepository,
      input.campusId,
      new Date(),
    );

    const commitAttemptId = await this.lifecycleRepository.startCommitAttempt({
      lifecycleRunId: input.lifecycleRunId,
      previewRunId: preview.id,
      runVersion: preview.runVersion!,
      campusId: input.campusId,
      createdByUserId: currentUser.id,
    });
    if (!commitAttemptId) {
      const currentPreview = await this.lifecycleRepository.findPreviewRunById(
        preview.id,
        input.campusId,
      );
      if (currentPreview?.status === "VALID") {
        throw new ConflictException("SOURCE_REGISTRATION_CANCELLED");
      }
      throw new ConflictException(
        this.previewStatusCode(currentPreview?.status ?? "INVALIDATED"),
      );
    }

    try {
      const result = await this.commitSchoolYearLifecycleUseCase.execute(
        {
          campusId: input.campusId,
          previewRunId: preview.id,
          digest: input.digest,
          allowRunScoped: true,
          lifecycleRunId: input.lifecycleRunId,
          runVersion: preview.runVersion,
          scopeIdentity: preview.scopeIdentity,
          commitAttemptId,
          candidateIdsByStudentId: Object.fromEntries(
            memberships.map((membership) => [
              membership.studentId,
              membership.candidateId,
            ]),
          ),
        },
        currentUser,
      );
      const membershipByStudentId = new Map(
        memberships.map((membership) => [membership.studentId, membership]),
      );
      if (
        result.rows.length !== memberships.length ||
        result.rows.some((row) => !membershipByStudentId.has(row.studentId))
      ) {
        throw new Error("COMMIT_SCOPE_MEMBERSHIP_MISMATCH");
      }
      const finalized = await this.lifecycleRepository.finalizeCommitAttempt({
        commitAttemptId,
        lifecycleRunId: input.lifecycleRunId,
        previewRunId: preview.id,
        campusId: input.campusId,
        rows: result.rows.map((row) => ({
          candidateId: membershipByStudentId.get(row.studentId)!.candidateId,
          result: row,
        })),
        retention,
      });

      return {
        ...result,
        lifecycleRunId: input.lifecycleRunId,
        commitAttemptId,
        runStatus: finalized.run.status,
        runVersion: finalized.run.version,
      };
    } catch (error) {
      await this.lifecycleRepository.failCommitAttempt(
        commitAttemptId,
        preview.id,
        input.campusId,
        retention,
      );
      throw error;
    }
  }

  private previewStatusCode(status: string): string {
    switch (status) {
      case "EXPIRED":
        return "PREVIEW_EXPIRED";
      case "SUPERSEDED":
        return "PREVIEW_SUPERSEDED";
      case "FINALIZED":
        return "PREVIEW_FINALIZED";
      case "COMMITTING":
        return "PREVIEW_COMMIT_IN_PROGRESS";
      default:
        return "PREVIEW_INVALIDATED";
    }
  }
}
