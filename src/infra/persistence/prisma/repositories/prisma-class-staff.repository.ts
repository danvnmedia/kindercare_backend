import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { ClassStaffRepository } from "@/application/class-management/ports/class-staff.repository";
import { ClassStaff } from "@/domain/class-management/entities/class-staff.entity";
import { ClassStaffRole } from "@/domain/class-management/enums/class-staff-role.enum";
import { PrismaClassStaffMapper } from "../mapper/prisma-class-staff.mapper";

@Injectable()
export class PrismaClassStaffRepository implements ClassStaffRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByPair(
    classId: string,
    staffId: string,
  ): Promise<ClassStaff | null> {
    const prismaClassStaff = await this.prisma.classStaff.findUnique({
      where: {
        classId_staffId: { classId, staffId },
      },
      include: {
        class: true,
        staff: { include: { staffTypes: { include: { staffType: true } } } },
      },
    });
    return prismaClassStaff
      ? PrismaClassStaffMapper.toDomain(prismaClassStaff)
      : null;
  }

  async findHomeroomByClassId(classId: string): Promise<ClassStaff | null> {
    const prismaClassStaff = await this.prisma.classStaff.findFirst({
      where: { classId, role: ClassStaffRole.HOMEROOM },
      include: {
        class: true,
        staff: { include: { staffTypes: { include: { staffType: true } } } },
      },
    });
    return prismaClassStaff
      ? PrismaClassStaffMapper.toDomain(prismaClassStaff)
      : null;
  }

  async findByClassId(classId: string): Promise<ClassStaff[]> {
    const prismaClassStaffs = await this.prisma.classStaff.findMany({
      where: { classId },
      include: {
        class: true,
        staff: { include: { staffTypes: { include: { staffType: true } } } },
      },
    });
    return PrismaClassStaffMapper.toDomainArray(prismaClassStaffs);
  }

  async findByStaffId(staffId: string): Promise<ClassStaff[]> {
    const prismaClassStaffs = await this.prisma.classStaff.findMany({
      where: { staffId },
      include: {
        class: true,
        staff: { include: { staffTypes: { include: { staffType: true } } } },
      },
    });
    return PrismaClassStaffMapper.toDomainArray(prismaClassStaffs);
  }

  async save(classStaff: ClassStaff): Promise<ClassStaff> {
    const prismaData = PrismaClassStaffMapper.toPrisma(classStaff);
    const created = await this.prisma.classStaff.create({
      data: prismaData,
      include: {
        class: true,
        staff: { include: { staffTypes: { include: { staffType: true } } } },
      },
    });
    return PrismaClassStaffMapper.toDomain(created);
  }

  async update(classStaff: ClassStaff): Promise<ClassStaff> {
    const updateData = PrismaClassStaffMapper.toPrismaUpdate(classStaff);
    const updated = await this.prisma.classStaff.update({
      where: {
        classId_staffId: {
          classId: classStaff.classId,
          staffId: classStaff.staffId,
        },
      },
      data: updateData,
      include: {
        class: true,
        staff: { include: { staffTypes: { include: { staffType: true } } } },
      },
    });
    return PrismaClassStaffMapper.toDomain(updated);
  }

  async delete(classId: string, staffId: string): Promise<void> {
    await this.prisma.classStaff.delete({
      where: {
        classId_staffId: { classId, staffId },
      },
    });
  }

  async deleteByClassId(classId: string): Promise<void> {
    await this.prisma.classStaff.deleteMany({
      where: { classId },
    });
  }

  async deleteByStaffId(staffId: string): Promise<void> {
    await this.prisma.classStaff.deleteMany({
      where: { staffId },
    });
  }
}
