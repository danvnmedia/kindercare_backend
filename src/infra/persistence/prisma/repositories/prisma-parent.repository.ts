import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ParentRepository } from '@/application/user-management/ports/parent.repository';
import { Parent } from '@/domain/user-management/parent.entity';
import { PrismaParentMapper } from '../mapper/prisma-parent.mapper';
import { StandardRequest } from '@/core/modules/standard-response/dto/standard-request.dto';
import { PaginatedResult } from '@/core/modules/standard-response/dto/query.dto';
import { PrismaQueryService } from '@/core/modules/standard-response/services/prisma-query.service';

@Injectable()
export class PrismaParentRepository implements ParentRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queryService: PrismaQueryService,
  ) {}

  async findById(id: string): Promise<Parent | null> {
    const prismaParent = await this.prisma.parent.findUnique({
      where: { id },
      include: {
        spouse: true,
      },
    });
    return prismaParent ? PrismaParentMapper.toDomain(prismaParent) : null;
  }

  async findByEmail(email: string): Promise<Parent | null> {
    const prismaParent = await this.prisma.parent.findUnique({
      where: { email },
      include: {
        spouse: true,
      },
    });
    return prismaParent ? PrismaParentMapper.toDomain(prismaParent) : null;
  }

  async findByPhoneNumber(phoneNumber: string): Promise<Parent | null> {
    const prismaParent = await this.prisma.parent.findUnique({
      where: { phoneNumber },
      include: {
        spouse: true,
      },
    });
    return prismaParent ? PrismaParentMapper.toDomain(prismaParent) : null;
  }

  async findAll(params: StandardRequest): Promise<PaginatedResult<Parent>> {
    // Define allowed fields for filtering and sorting
    params.allowedFilterFields = [
      'fullName',
      'email',
      'phoneNumber',
      'gender',
      'occupation',
      'workAddress',
      'isArchived',
    ];
    params.allowedSortFields = [
      'createdAt',
      'updatedAt',
      'fullName',
      'occupation',
    ];

    // Use PrismaQueryService to execute query with StandardRequest
    return await this.queryService.executeQuery<Parent>(
      this.prisma,
      'parent',
      params,
      {},
      PrismaParentMapper,
    );
  }

  async findByIds(ids: string[]): Promise<Parent[]> {
    const parents = await this.prisma.parent.findMany({
      where: {
        id: { in: ids },
      },
    });
    return parents.map(PrismaParentMapper.toDomain);
  }

  async save(
    parent: Omit<Parent, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Parent> {
    const prismaData = PrismaParentMapper.toPrismaCreate(parent);
    const created = await this.prisma.parent.create({
      data: prismaData,
    });
    return PrismaParentMapper.toDomain(created);
  }

  async update(id: string, data: Partial<Parent>): Promise<Parent> {
    const prismaData = PrismaParentMapper.toPrismaUpdate(data);
    const updated = await this.prisma.parent.update({
      where: { id },
      data: prismaData,
    });
    return PrismaParentMapper.toDomain(updated);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.parent.delete({
      where: { id },
    });
  }

  async getParentChildren(parentId: string): Promise<any[]> {
    const studentParents = await this.prisma.studentParent.findMany({
      where: { parentId },
      include: {
        student: {
          include: {
            class: true,
          },
        },
        parentRelationship: true,
      },
    });

    return studentParents.map((sp) => ({
      studentId: sp.student.id,
      fullName: sp.student.fullName,
      nickname: sp.student.nickname,
      className: sp.student.class?.name,
      relationship: sp.parentRelationship.id,
      relationshipName: sp.parentRelationship.name,
    }));
  }
}
