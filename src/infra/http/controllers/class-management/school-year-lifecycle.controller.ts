import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseUUIDPipe,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Put,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";

import {
  BulkSaveSchoolYearLifecycleDecisionsUseCase,
  CancelSchoolYearLifecycleRunUseCase,
  CommitSchoolYearLifecycleUseCase,
  CommitSchoolYearLifecycleRunUseCase,
  CreateOrResumeSchoolYearLifecycleRunUseCase,
  GetSchoolYearLifecycleRunUseCase,
  GetSchoolYearLifecycleCandidatesUseCase,
  GetSchoolYearLifecycleProgressUseCase,
  GetSchoolYearLifecycleResultsUseCase,
  PreviewSchoolYearLifecycleUseCase,
  PreviewSchoolYearLifecycleRunUseCase,
  RefreshSchoolYearLifecycleCandidatesUseCase,
  SaveSchoolYearLifecycleDecisionsUseCase,
  UpdateSchoolYearLifecycleRunSetupUseCase,
} from "@/application/class-management/use-cases/school-year-lifecycle";
import { parseDateOnly } from "@/application/class-management/date-only";
import { StandardResponse } from "@/core/modules/standard-response/decorators/standard-response.decorator";
import { User } from "@/domain/user-management/user.entity";

import {
  CAMPUS_ID_HEADER,
  CampusContext,
  CurrentUser,
  RequireCampusAccess,
} from "../../decorators";
import { Permissions } from "../../decorators/permissions.decorator";
import {
  BulkSaveSchoolYearLifecycleDecisionsRequest,
  CancelSchoolYearLifecycleRunRequest,
  SchoolYearLifecycleCommitRequest,
  SchoolYearLifecycleCommitResponse,
  CreateSchoolYearLifecycleRunRequest,
  GetSchoolYearLifecycleCandidatesQuery,
  SchoolYearLifecyclePreviewRequest,
  SchoolYearLifecyclePreviewResponse,
  SchoolYearLifecycleRunDetailResponse,
  SchoolYearLifecycleCandidateResponse,
  SchoolYearLifecycleProgressResponse,
  RefreshSchoolYearLifecycleCandidatesRequest,
  RefreshSchoolYearLifecycleCandidatesResponse,
  PreviewSchoolYearLifecycleRunRequest,
  RunScopedSchoolYearLifecyclePreviewResponse,
  RunScopedSchoolYearLifecycleCommitResponse,
  SchoolYearLifecycleCommitAttemptResponse,
  SaveSchoolYearLifecycleDecisionsRequest,
  SchoolYearLifecycleDecisionSaveResponse,
  UpdateSchoolYearLifecycleRunSetupRequest,
} from "../../dtos/class-management";
import { ClerkAuthGuard } from "../../guards/clerk-auth.guard";
import { PermissionsGuard } from "../../guards/permissions.guard";

@Controller("school-year-lifecycle")
@ApiTags("School Year Lifecycle")
@ApiBearerAuth("JWT")
@UseGuards(ClerkAuthGuard, PermissionsGuard)
export class SchoolYearLifecycleController {
  constructor(
    private readonly createOrResumeRunUseCase: CreateOrResumeSchoolYearLifecycleRunUseCase,
    private readonly getRunUseCase: GetSchoolYearLifecycleRunUseCase,
    private readonly getCandidatesUseCase: GetSchoolYearLifecycleCandidatesUseCase,
    private readonly getProgressUseCase: GetSchoolYearLifecycleProgressUseCase,
    private readonly refreshCandidatesUseCase: RefreshSchoolYearLifecycleCandidatesUseCase,
    private readonly saveDecisionsUseCase: SaveSchoolYearLifecycleDecisionsUseCase,
    private readonly bulkSaveDecisionsUseCase: BulkSaveSchoolYearLifecycleDecisionsUseCase,
    private readonly previewRunUseCase: PreviewSchoolYearLifecycleRunUseCase,
    private readonly commitRunUseCase: CommitSchoolYearLifecycleRunUseCase,
    private readonly getResultsUseCase: GetSchoolYearLifecycleResultsUseCase,
    private readonly updateRunSetupUseCase: UpdateSchoolYearLifecycleRunSetupUseCase,
    private readonly cancelRunUseCase: CancelSchoolYearLifecycleRunUseCase,
    private readonly previewSchoolYearLifecycleUseCase: PreviewSchoolYearLifecycleUseCase,
    private readonly commitSchoolYearLifecycleUseCase: CommitSchoolYearLifecycleUseCase,
  ) {}

  @Post("runs")
  @RequireCampusAccess()
  @Permissions("school_year_lifecycle.manage")
  @StandardResponse({
    message: "School-year lifecycle run created or resumed",
    type: SchoolYearLifecycleRunDetailResponse,
  })
  @ApiOperation({ summary: "Create or resume a school-year lifecycle run" })
  @ApiHeader({ name: CAMPUS_ID_HEADER, required: true })
  async createOrResumeRun(
    @CampusContext() campusId: string,
    @Body() dto: CreateSchoolYearLifecycleRunRequest,
    @CurrentUser() currentUser: User,
  ) {
    return await this.createOrResumeRunUseCase.execute(
      {
        campusId,
        sourceSchoolYearId: dto.sourceSchoolYearId,
        targetSchoolYearId: dto.targetSchoolYearId,
        sourceClosureDate: parseDateOnly(dto.sourceClosureDate),
        targetEnrollmentDate: parseDateOnly(dto.targetEnrollmentDate),
      },
      currentUser,
    );
  }

  @Get("runs/:lifecycleRunId")
  @RequireCampusAccess()
  @Permissions("school_year_lifecycle.read")
  @StandardResponse({
    message: "School-year lifecycle run retrieved",
    type: SchoolYearLifecycleRunDetailResponse,
  })
  @ApiOperation({ summary: "Get a school-year lifecycle run" })
  @ApiHeader({ name: CAMPUS_ID_HEADER, required: true })
  async getRun(
    @CampusContext() campusId: string,
    @Param("lifecycleRunId", ParseUUIDPipe) lifecycleRunId: string,
  ) {
    return await this.getRunUseCase.execute(lifecycleRunId, campusId);
  }

  @Get("runs/:lifecycleRunId/candidates")
  @RequireCampusAccess()
  @Permissions("school_year_lifecycle.read")
  @StandardResponse({
    message: "School-year lifecycle candidates retrieved",
    type: SchoolYearLifecycleCandidateResponse,
    isPaginated: true,
  })
  @ApiOperation({ summary: "List lifecycle candidates with bounded paging" })
  @ApiHeader({ name: CAMPUS_ID_HEADER, required: true })
  async getCandidates(
    @CampusContext() campusId: string,
    @Param("lifecycleRunId", ParseUUIDPipe) lifecycleRunId: string,
    @Query() query: GetSchoolYearLifecycleCandidatesQuery,
  ) {
    return await this.getCandidatesUseCase.execute(lifecycleRunId, campusId, {
      offset: query.offset,
      limit: query.limit,
      search: query.search,
      sourceGradeLevelId: query.sourceGradeLevelId,
      sourceClassId: query.unassigned ? null : query.sourceClassId,
      status: query.status,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    });
  }

  @Get("runs/:lifecycleRunId/progress")
  @RequireCampusAccess()
  @Permissions("school_year_lifecycle.read")
  @StandardResponse({
    message: "School-year lifecycle progress retrieved",
    type: SchoolYearLifecycleProgressResponse,
  })
  @ApiOperation({ summary: "Get authoritative lifecycle progress" })
  @ApiHeader({ name: CAMPUS_ID_HEADER, required: true })
  async getProgress(
    @CampusContext() campusId: string,
    @Param("lifecycleRunId", ParseUUIDPipe) lifecycleRunId: string,
  ) {
    return await this.getProgressUseCase.execute(lifecycleRunId, campusId);
  }

  @Post("runs/:lifecycleRunId/refresh")
  @RequireCampusAccess()
  @Permissions("school_year_lifecycle.manage")
  @StandardResponse({
    message: "School-year lifecycle candidates refreshed",
    type: RefreshSchoolYearLifecycleCandidatesResponse,
  })
  @ApiOperation({
    summary: "Reconcile a run with current source registrations",
  })
  @ApiHeader({ name: CAMPUS_ID_HEADER, required: true })
  async refreshCandidates(
    @CampusContext() campusId: string,
    @Param("lifecycleRunId", ParseUUIDPipe) lifecycleRunId: string,
    @Body() dto: RefreshSchoolYearLifecycleCandidatesRequest,
    @CurrentUser() currentUser: User,
  ) {
    return await this.refreshCandidatesUseCase.execute(
      { lifecycleRunId, campusId, expectedVersion: dto.expectedVersion },
      currentUser,
    );
  }

  @Put("runs/:lifecycleRunId/decisions")
  @RequireCampusAccess()
  @Permissions("school_year_lifecycle.manage")
  @StandardResponse({
    message: "School-year lifecycle decisions saved",
    type: SchoolYearLifecycleDecisionSaveResponse,
  })
  @ApiOperation({ summary: "Save bounded lifecycle candidate decisions" })
  @ApiHeader({ name: CAMPUS_ID_HEADER, required: true })
  async saveDecisions(
    @CampusContext() campusId: string,
    @Param("lifecycleRunId", ParseUUIDPipe) lifecycleRunId: string,
    @Body() dto: SaveSchoolYearLifecycleDecisionsRequest,
    @CurrentUser() currentUser: User,
  ) {
    return await this.saveDecisionsUseCase.execute(
      {
        lifecycleRunId,
        campusId,
        expectedVersion: dto.expectedVersion,
        decisions: dto.decisions,
      },
      currentUser,
    );
  }

  @Post("runs/:lifecycleRunId/decisions/bulk")
  @RequireCampusAccess()
  @Permissions("school_year_lifecycle.manage")
  @StandardResponse({
    message: "School-year lifecycle bulk decision completed",
    type: SchoolYearLifecycleDecisionSaveResponse,
  })
  @ApiOperation({ summary: "Save a decision across a full filtered scope" })
  @ApiHeader({ name: CAMPUS_ID_HEADER, required: true })
  async bulkSaveDecisions(
    @CampusContext() campusId: string,
    @Param("lifecycleRunId", ParseUUIDPipe) lifecycleRunId: string,
    @Body() dto: BulkSaveSchoolYearLifecycleDecisionsRequest,
    @CurrentUser() currentUser: User,
  ) {
    return await this.bulkSaveDecisionsUseCase.execute(
      {
        lifecycleRunId,
        campusId,
        expectedVersion: dto.expectedVersion,
        filter: {
          search: dto.search,
          sourceGradeLevelId: dto.sourceGradeLevelId,
          sourceClassId: dto.unassigned ? null : dto.sourceClassId,
          status: dto.status,
        },
        outcome: dto.outcome,
        targetClassId: dto.targetClassId,
        note: dto.note,
      },
      currentUser,
    );
  }

  @Patch("runs/:lifecycleRunId/setup")
  @RequireCampusAccess()
  @Permissions("school_year_lifecycle.manage")
  @StandardResponse({
    message: "School-year lifecycle setup updated",
    type: SchoolYearLifecycleRunDetailResponse,
  })
  @ApiOperation({ summary: "Update lifecycle setup before the first commit" })
  @ApiHeader({ name: CAMPUS_ID_HEADER, required: true })
  async updateRunSetup(
    @CampusContext() campusId: string,
    @Param("lifecycleRunId", ParseUUIDPipe) lifecycleRunId: string,
    @Body() dto: UpdateSchoolYearLifecycleRunSetupRequest,
    @CurrentUser() currentUser: User,
  ) {
    return await this.updateRunSetupUseCase.execute(
      {
        lifecycleRunId,
        campusId,
        targetSchoolYearId: dto.targetSchoolYearId,
        sourceClosureDate: parseDateOnly(dto.sourceClosureDate),
        targetEnrollmentDate: parseDateOnly(dto.targetEnrollmentDate),
        expectedVersion: dto.expectedVersion,
      },
      currentUser,
    );
  }

  @Post("runs/:lifecycleRunId/cancel")
  @RequireCampusAccess()
  @Permissions("school_year_lifecycle.manage")
  @StandardResponse({
    message: "School-year lifecycle run cancelled",
    type: SchoolYearLifecycleRunDetailResponse,
  })
  @ApiOperation({ summary: "Cancel a lifecycle run before the first commit" })
  @ApiHeader({ name: CAMPUS_ID_HEADER, required: true })
  async cancelRun(
    @CampusContext() campusId: string,
    @Param("lifecycleRunId", ParseUUIDPipe) lifecycleRunId: string,
    @Body() dto: CancelSchoolYearLifecycleRunRequest,
    @CurrentUser() currentUser: User,
  ) {
    return await this.cancelRunUseCase.execute(
      { lifecycleRunId, campusId, expectedVersion: dto.expectedVersion },
      currentUser,
    );
  }

  @Post("runs/:lifecycleRunId/preview")
  @RequireCampusAccess()
  @Permissions("school_year_lifecycle.preview")
  @StandardResponse({
    message: "Run-scoped school-year lifecycle preview created",
    type: RunScopedSchoolYearLifecyclePreviewResponse,
  })
  @ApiOperation({ summary: "Preview an exact persisted lifecycle run scope" })
  @ApiHeader({ name: CAMPUS_ID_HEADER, required: true })
  async previewRun(
    @CampusContext() campusId: string,
    @Param("lifecycleRunId", ParseUUIDPipe) lifecycleRunId: string,
    @Body() dto: PreviewSchoolYearLifecycleRunRequest,
    @CurrentUser() currentUser: User,
  ) {
    return await this.previewRunUseCase.execute(
      {
        lifecycleRunId,
        campusId,
        expectedVersion: dto.expectedVersion,
        scope: dto.scope,
      },
      currentUser,
    );
  }

  @Post("runs/:lifecycleRunId/commit")
  @RequireCampusAccess()
  @Permissions("school_year_lifecycle.commit")
  @StandardResponse({
    message: "Run-scoped school-year lifecycle commit completed",
    type: RunScopedSchoolYearLifecycleCommitResponse,
  })
  @ApiOperation({ summary: "Commit an exact reviewed lifecycle run preview" })
  @ApiHeader({ name: CAMPUS_ID_HEADER, required: true })
  async commitRun(
    @CampusContext() campusId: string,
    @Param("lifecycleRunId", ParseUUIDPipe) lifecycleRunId: string,
    @Body() dto: SchoolYearLifecycleCommitRequest,
    @CurrentUser() currentUser: User,
  ) {
    return await this.commitRunUseCase.execute(
      {
        lifecycleRunId,
        campusId,
        previewRunId: dto.previewRunId,
        digest: dto.digest,
      },
      currentUser,
    );
  }

  @Get("runs/:lifecycleRunId/results")
  @RequireCampusAccess()
  @Permissions("school_year_lifecycle.read")
  @StandardResponse({
    message: "School-year lifecycle commit results retrieved",
    type: SchoolYearLifecycleCommitAttemptResponse,
    isArray: true,
  })
  @ApiOperation({ summary: "Retrieve persisted lifecycle commit attempts" })
  @ApiHeader({ name: CAMPUS_ID_HEADER, required: true })
  async getResults(
    @CampusContext() campusId: string,
    @Param("lifecycleRunId", ParseUUIDPipe) lifecycleRunId: string,
    @Query("limit", new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return await this.getResultsUseCase.execute(
      lifecycleRunId,
      campusId,
      limit,
    );
  }

  @Post("preview")
  @RequireCampusAccess()
  @Permissions("school_year_lifecycle.preview")
  @StandardResponse({
    message: "School-year lifecycle preview created",
    type: SchoolYearLifecyclePreviewResponse,
  })
  @ApiOperation({
    summary: "Preview a school-year lifecycle rollover",
    deprecated: true,
    description:
      "Legacy explicit-row preview retained during migration. New clients should create a run and use POST /school-year-lifecycle/runs/{lifecycleRunId}/preview. Empty rows are rejected and never expand to whole-school work.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus ID for the operation",
  })
  async preview(
    @CampusContext() campusId: string,
    @Body() dto: SchoolYearLifecyclePreviewRequest,
    @CurrentUser() currentUser: User,
  ) {
    return await this.previewSchoolYearLifecycleUseCase.execute(
      {
        campusId,
        sourceSchoolYearId: dto.sourceSchoolYearId,
        targetSchoolYearId: dto.targetSchoolYearId,
        sourceClosureDate: parseDateOnly(dto.sourceClosureDate),
        targetEnrollmentDate: parseDateOnly(dto.targetEnrollmentDate),
        rows: dto.rows.map((row) => ({
          studentId: row.studentId,
          outcome: row.outcome,
          targetClassId: row.targetClassId,
          note: row.note,
        })),
      },
      currentUser,
    );
  }

  @Post("commit")
  @RequireCampusAccess()
  @Permissions("school_year_lifecycle.commit")
  @StandardResponse({
    message: "School-year lifecycle commit completed",
    type: SchoolYearLifecycleCommitResponse,
  })
  @ApiOperation({
    summary: "Commit a reviewed school-year lifecycle preview",
    deprecated: true,
    description:
      "Legacy commit retained for legacy preview tokens. New clients should use POST /school-year-lifecycle/runs/{lifecycleRunId}/commit; run-scoped previews are rejected by this endpoint.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus ID for the operation",
  })
  async commit(
    @CampusContext() campusId: string,
    @Body() dto: SchoolYearLifecycleCommitRequest,
    @CurrentUser() currentUser: User,
  ) {
    return await this.commitSchoolYearLifecycleUseCase.execute(
      {
        campusId,
        previewRunId: dto.previewRunId,
        digest: dto.digest,
      },
      currentUser,
    );
  }
}
