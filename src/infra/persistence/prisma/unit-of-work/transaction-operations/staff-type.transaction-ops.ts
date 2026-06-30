import { StaffType } from "@/domain/user-management/entities/staff-type.entity";
import { PrismaStaffTypeMapper } from "../../mapper/prisma-staff-type.mapper";
import { PrismaTransactionClient } from "./base.transaction-ops";

const STAFF_TYPE_INCLUDE = { defaultRole: true } as const;

export class StaffTypeTransactionOps {
  constructor(private readonly tx: PrismaTransactionClient) {}

  async createStaffType(staffType: StaffType): Promise<StaffType> {
    const created = await this.tx.staffType.create({
      data: PrismaStaffTypeMapper.toPrisma(staffType),
      include: STAFF_TYPE_INCLUDE,
    });

    return PrismaStaffTypeMapper.toDomain(created);
  }

  async updateStaffType(staffType: StaffType): Promise<StaffType> {
    const updated = await this.tx.staffType.update({
      where: { id: staffType.id },
      data: PrismaStaffTypeMapper.toPrismaUpdate(staffType),
      include: STAFF_TYPE_INCLUDE,
    });

    return PrismaStaffTypeMapper.toDomain(updated);
  }

  async reorderStaffTypes(
    campusId: string,
    ids: string[],
  ): Promise<StaffType[]> {
    for (const [index, id] of ids.entries()) {
      await this.tx.staffType.update({
        where: { id },
        data: { order: -(index + 1) },
      });
    }

    for (const [index, id] of ids.entries()) {
      await this.tx.staffType.update({
        where: { id },
        data: { order: index + 1 },
      });
    }

    const updated = await this.tx.staffType.findMany({
      where: { id: { in: ids }, campusId },
      include: STAFF_TYPE_INCLUDE,
      orderBy: { order: "asc" },
    });

    return PrismaStaffTypeMapper.toDomainArray(updated);
  }
}
