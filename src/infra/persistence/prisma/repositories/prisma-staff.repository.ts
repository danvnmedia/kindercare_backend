import { StaffRepository } from "@/application/user-management/ports/staff.repository";
import { FilterSchemaDto } from "@/core/modules/standard-response/dto/filter-schema.dto";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PrismaQueryService } from "@/core/modules/standard-response/services/prisma-query.service";
import { Staff } from "@/domain/user-management/entities/staff.entity";
import { Injectable } from "@nestjs/common";
import { PrismaStaffMapper } from "../mapper/prisma-staff.mapper";
import { PrismaService } from "../prisma.service";

/**
 * Canonical include shape for queries that need the read-side StaffType
 * collection hydrated on the domain entity. Centralized so every read path
 * stays in lockstep with `PrismaStaffMapper.toDomain`'s expected shape.
 */
const STAFF_TYPES_INCLUDE = {
  staffTypes: { include: { staffType: true } },
} as const;

const STAFF_INCLUDE_WITH_USER = {
  user: true,
  ...STAFF_TYPES_INCLUDE,
} as const;

/**
 * Extracts the staff-type id list from a `staffTypeIds` filter envelope.
 * Accepts the canonical `{ in: [...] }` FilterConditionDto shape, a bare
 * array (defensive — clients sometimes pass the array directly), or a single
 * string (single-id shorthand). Returns null when no usable ids are present
 * so the caller can skip injecting a relation clause.
 */
function extractStaffTypeIds(value: unknown): string[] | null {
  if (value == null) return null;
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string");
  }
  if (typeof value === "string") {
    return [value];
  }
  if (typeof value === "object" && "in" in (value as Record<string, unknown>)) {
    const inValue = (value as { in?: unknown }).in;
    if (Array.isArray(inValue)) {
      return inValue.filter((v): v is string => typeof v === "string");
    }
  }
  return null;
}

@Injectable()
export class PrismaStaffRepository implements StaffRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queryService: PrismaQueryService,
  ) {}

  async findById(id: string): Promise<Staff | null> {
    const prismaStaff = await this.prisma.staff.findUnique({
      where: { id },
      include: STAFF_INCLUDE_WITH_USER,
    });
    return prismaStaff ? PrismaStaffMapper.toDomain(prismaStaff) : null;
  }

  async findByEmail(email: string): Promise<Staff | null> {
    const prismaStaff = await this.prisma.staff.findFirst({
      where: { email },
      include: STAFF_TYPES_INCLUDE,
    });
    return prismaStaff ? PrismaStaffMapper.toDomain(prismaStaff) : null;
  }

  async findByEmailInCampus(
    campusId: string,
    email: string,
  ): Promise<Staff | null> {
    const prismaStaff = await this.prisma.staff.findUnique({
      where: {
        campusId_email: { campusId, email },
      },
      include: STAFF_TYPES_INCLUDE,
    });
    return prismaStaff ? PrismaStaffMapper.toDomain(prismaStaff) : null;
  }

  async findByPhoneNumber(phoneNumber: string): Promise<Staff | null> {
    const prismaStaff = await this.prisma.staff.findFirst({
      where: { phoneNumber },
      include: STAFF_TYPES_INCLUDE,
    });
    return prismaStaff ? PrismaStaffMapper.toDomain(prismaStaff) : null;
  }

  async findByPhoneNumberInCampus(
    campusId: string,
    phoneNumber: string,
  ): Promise<Staff | null> {
    const prismaStaff = await this.prisma.staff.findUnique({
      where: {
        campusId_phoneNumber: { campusId, phoneNumber },
      },
      include: STAFF_TYPES_INCLUDE,
    });
    return prismaStaff ? PrismaStaffMapper.toDomain(prismaStaff) : null;
  }

  async findByUserId(userId: string): Promise<Staff | null> {
    const prismaStaff = await this.prisma.staff.findFirst({
      where: { userId },
      include: STAFF_INCLUDE_WITH_USER,
    });
    return prismaStaff ? PrismaStaffMapper.toDomain(prismaStaff) : null;
  }

  async findByStaffTypeId(staffTypeId: string): Promise<Staff[]> {
    // `some` semantics: a staff matches when ANY of their `staff_staff_type`
    // rows points at the given type. Compiles to `EXISTS (SELECT 1 FROM
    // staff_staff_type ...)` on Postgres — the canonical relation predicate
    // under the new multi-type schema.
    const prismaStaffs = await this.prisma.staff.findMany({
      where: { staffTypes: { some: { staffTypeId } } },
      include: STAFF_INCLUDE_WITH_USER,
    });
    return PrismaStaffMapper.toDomainArray(prismaStaffs);
  }

  async findByCampusId(campusId: string): Promise<Staff[]> {
    const prismaStaffs = await this.prisma.staff.findMany({
      where: { campusId },
      include: STAFF_INCLUDE_WITH_USER,
    });
    return PrismaStaffMapper.toDomainArray(prismaStaffs);
  }

  async findByIds(ids: string[]): Promise<Staff[]> {
    const prismaStaffs = await this.prisma.staff.findMany({
      where: { id: { in: ids } },
      include: STAFF_INCLUDE_WITH_USER,
    });
    return PrismaStaffMapper.toDomainArray(prismaStaffs);
  }

  async findAll(
    params: StandardRequest,
    scope?: Record<string, any>,
  ): Promise<PaginatedResult<Staff>> {
    // Define allowed fields for filtering and sorting. `staffTypeIds` is
    // intentionally absent: the standard query service is flat-field-only,
    // so the relation filter is handled below via pre-extraction +
    // `options.where` injection (mirrors the `classes: { none: { classId } }`
    // pattern in `findEligibleForClass`). See
    // @doc/specs/staff-multi-type-refactor#technical-notes → Repository
    // filter pre-extraction (FR-6).
    params.allowedFilterFields = [
      "campusId",
      "staffCode",
      "fullName",
      "email",
      "phoneNumber",
      "gender",
      "isArchived",
    ];
    params.allowedSortFields = [
      "createdAt",
      "updatedAt",
      "staffCode",
      "fullName",
      "email",
      "startDate",
    ];

    // Ensure filterInfo.filters is populated so we can extract before
    // delegating. Mirrors PrismaQueryService.executeQuery's own parser so
    // both JSON-string and pre-parsed envelopes are handled identically.
    let filters: Record<string, unknown> = {};
    if (
      params.filterInfo?.filters &&
      Object.keys(params.filterInfo.filters).length > 0
    ) {
      filters = { ...params.filterInfo.filters };
    } else if (params.filter && typeof params.filter === "string") {
      try {
        filters = JSON.parse(params.filter) as Record<string, unknown>;
      } catch {
        filters = {};
      }
    }

    const staffTypeIdsFilter = filters.staffTypeIds;
    delete filters.staffTypeIds;

    // Write the sanitized envelope back so the query service does not see
    // (and reject) the relation key. Also clear `params.filter` so its own
    // parser does not re-introduce the deleted field.
    params.filterInfo = { filters: filters as FilterSchemaDto["filters"] };
    params.filter = undefined;

    const ids = extractStaffTypeIds(staffTypeIdsFilter);
    const relationWhere =
      ids && ids.length > 0
        ? { staffTypes: { some: { staffTypeId: { in: ids } } } }
        : {};

    return await this.queryService.executeQuery<Staff>(
      this.prisma,
      "staff",
      params,
      {
        where: relationWhere,
        include: STAFF_INCLUDE_WITH_USER,
        scope,
      },
      PrismaStaffMapper,
    );
  }

  async findEligibleForClass(
    classId: string,
    params: StandardRequest,
    scope?: { campusId: string },
  ): Promise<PaginatedResult<Staff>> {
    // Narrow user-controllable surface: caller may filter by fullName (ilike
    // for ?search). isArchived, the anti-join on classStaff, and
    // scope.campusId are all system-enforced via `where` + `scope`.
    params.allowedFilterFields = ["fullName"];
    params.allowedSortFields = [
      "fullName",
      "staffCode",
      "createdAt",
      "startDate",
    ];

    return await this.queryService.executeQuery<Staff>(
      this.prisma,
      "staff",
      params,
      {
        where: {
          isArchived: false,
          // Anti-join: exclude staff already linked to the target class via
          // any classStaff row, regardless of their role on that row
          // (@doc/specs/bulk-class-staff-assignment AC-13). Prisma `none` is
          // a typed NOT EXISTS equivalent permitted by D4.
          classes: { none: { classId } },
        },
        include: STAFF_INCLUDE_WITH_USER,
        orderBy: { createdAt: "desc" },
        scope,
      },
      PrismaStaffMapper,
    );
  }

  async save(staff: Staff): Promise<Staff> {
    const prismaData = PrismaStaffMapper.toPrisma(staff);
    const created = await this.prisma.staff.create({
      data: prismaData,
      include: STAFF_INCLUDE_WITH_USER,
    });
    return PrismaStaffMapper.toDomain(created);
  }

  async update(staff: Staff): Promise<Staff> {
    const prismaData = PrismaStaffMapper.toPrismaUpdate(staff);
    const updated = await this.prisma.staff.update({
      where: { id: staff.id },
      data: prismaData,
      include: STAFF_INCLUDE_WITH_USER,
    });
    return PrismaStaffMapper.toDomain(updated);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.staff.delete({
      where: { id },
    });
  }
}
