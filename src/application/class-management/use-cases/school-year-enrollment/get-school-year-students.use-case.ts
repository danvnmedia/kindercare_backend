import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { ExitReason } from "@/domain/class-management/enums/exit-reason.enum";
import { EnrollmentEffectiveStatus } from "@/domain/class-management/enums/enrollment-effective-status.enum";
import {
  buildHistoricalEnrollmentView,
  buildHistoricalSchoolYearEnrollmentView,
  HistoricalEnrollmentView,
  HistoricalSchoolYearEnrollmentView,
} from "../../historical-record-view";
import { HistoricalRecordRepository } from "../../ports/historical-record.repository";
import { SchoolYearRepository } from "../../ports/school-year.repository";
import {
  SchoolYearEnrollmentRepository,
  SchoolYearStudentClassAssignmentState,
  SchoolYearStudentSegment,
} from "../../ports/school-year-enrollment.repository";

export interface GetSchoolYearStudentsInput {
  campusId: string;
  schoolYearId: string;
  params: StandardRequest;
  segment?: SchoolYearStudentSegment;
  search?: string;
}

export interface SchoolYearStudentListItemView
  extends HistoricalSchoolYearEnrollmentView {
  schoolYearEnrollmentId: string;
  segment: SchoolYearStudentSegment;
  classAssignmentState: SchoolYearStudentClassAssignmentState;
  classAssignment: HistoricalEnrollmentView | null;
}

@Injectable()
export class GetSchoolYearStudentsUseCase {
  private readonly logger = new Logger(GetSchoolYearStudentsUseCase.name);

  constructor(
    @Inject("SCHOOL_YEAR_ENROLLMENT_REPOSITORY")
    private readonly schoolYearEnrollmentRepository: SchoolYearEnrollmentRepository,
    @Inject("SCHOOL_YEAR_REPOSITORY")
    private readonly schoolYearRepository: SchoolYearRepository,
    private readonly historicalRecordRepository: HistoricalRecordRepository,
  ) {}

  async execute(
    input: GetSchoolYearStudentsInput,
  ): Promise<PaginatedResult<SchoolYearStudentListItemView>> {
    const schoolYear = await this.schoolYearRepository.findById(
      input.schoolYearId,
    );
    if (!schoolYear || schoolYear.campusId !== input.campusId) {
      throw new NotFoundException(
        `School year with ID ${input.schoolYearId} not found`,
      );
    }

    this.logger.log(
      `Fetching school-year student rows for schoolYear=${input.schoolYearId}, segment=${input.segment ?? "registered"}`,
    );

    const referenceDate = new Date();

    const result =
      await this.schoolYearEnrollmentRepository.findStudentsBySchoolYear(
        input.campusId,
        input.schoolYearId,
        input.params,
        referenceDate,
        {
          segment: input.segment,
          search: input.search,
        },
      );

    const data = await Promise.all(
      result.data.map(async (row) => {
        const schoolYearCorrections =
          await this.historicalRecordRepository.findCorrections(
            "SCHOOL_YEAR_ENROLLMENT",
            row.enrollment.id,
          );
        const schoolYearView = buildHistoricalSchoolYearEnrollmentView(
          row.enrollment,
          row.childEnrollmentCount,
          schoolYearCorrections,
          referenceDate,
        );

        const classAssignment = row.classAssignment
          ? buildHistoricalEnrollmentView(
              row.classAssignment,
              await this.historicalRecordRepository.findCorrections(
                "ENROLLMENT",
                row.classAssignment.id,
              ),
              referenceDate,
            )
          : null;

        return {
          ...schoolYearView,
          schoolYearEnrollmentId: schoolYearView.id,
          segment: deriveSegment(
            schoolYearView.effectiveStatus,
            schoolYearView.exitReason,
            row.classAssignmentState,
          ),
          classAssignmentState: row.classAssignmentState,
          classAssignment,
        };
      }),
    );

    return {
      data,
      pagination: result.pagination,
    };
  }
}

function deriveSegment(
  effectiveStatus: EnrollmentEffectiveStatus,
  exitReason: ExitReason | null,
  classAssignmentState: SchoolYearStudentClassAssignmentState,
): SchoolYearStudentSegment {
  if (effectiveStatus === EnrollmentEffectiveStatus.CANCELLED) {
    return "registered";
  }
  if (effectiveStatus === EnrollmentEffectiveStatus.UPCOMING) {
    return "upcoming";
  }
  if (effectiveStatus === EnrollmentEffectiveStatus.ACTIVE) {
    if (classAssignmentState === "ACTIVE") return "active";
    if (classAssignmentState === "UPCOMING") return "registered";
    return "unassigned";
  }
  if (exitReason === ExitReason.WITHDRAWN) return "withdrawn";
  if (exitReason === ExitReason.COMPLETED) return "completed";
  if (exitReason === ExitReason.GRADUATED) return "graduated";
  return "unresolved";
}
