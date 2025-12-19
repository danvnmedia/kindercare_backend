import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { ClassStaffRepository } from "@/application/class-management/ports/class-staff.repository";
import { ClassStaff } from "@/domain/class-management/entities/class-staff.entity";
import { PrismaClassStaffMapper } from "../mapper/prisma-class-staff.mapper";

@Injectable()
export class PrismaClassStaffRepository implements ClassStaffRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByCompositeKey(
    classId: string,
    staffId: string,
    subjectId: string,
  ): Promise<ClassStaff | null> {
    const prismaClassStaff = await this.prisma.classStaff.findUnique({
      where: {
        classId_staffId_subjectId: {
          classId,
          staffId,
          subjectId,
        },
      },
      include: {
        class: true,
        staff: true,
        subject: true,
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
        staff: true,
        subject: true,
      },
    });
    return PrismaClassStaffMapper.toDomainArray(prismaClassStaffs);
  }

  async findByStaffId(staffId: string): Promise<ClassStaff[]> {
    const prismaClassStaffs = await this.prisma.classStaff.findMany({
      where: { staffId },
      include: {
        class: true,
        staff: true,
        subject: true,
      },
    });
    return PrismaClassStaffMapper.toDomainArray(prismaClassStaffs);
  }

  async findBySubjectId(subjectId: string): Promise<ClassStaff[]> {
    const prismaClassStaffs = await this.prisma.classStaff.findMany({
      where: { subjectId },
      include: {
        class: true,
        staff: true,
        subject: true,
      },
    });
    return PrismaClassStaffMapper.toDomainArray(prismaClassStaffs);
  }

  async findByClassAndSubject(
    classId: string,
    subjectId: string,
  ): Promise<ClassStaff[]> {
    const prismaClassStaffs = await this.prisma.classStaff.findMany({
      where: { classId, subjectId },
      include: {
        class: true,
        staff: true,
        subject: true,
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
        staff: true,
        subject: true,
      },
    });
    return PrismaClassStaffMapper.toDomain(created);
  }

  async delete(
    classId: string,
    staffId: string,
    subjectId: string,
  ): Promise<void> {
    await this.prisma.classStaff.delete({
      where: {
        classId_staffId_subjectId: {
          classId,
          staffId,
          subjectId,
        },
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
