import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { FileRepository } from "../../../../application/file-management/ports/file.repository";
import { File } from "../../../../domain/file-management/entities/file.entity";
import { PrismaFileMapper } from "../mapper/prisma-file.mapper";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";
import { PrismaQueryService } from "@/core/modules/standard-response/services/prisma-query.service";
import { FileStatus } from "@/domain/file-management/enums/file-status.enum";
import { SoftDeleteFileResult } from "@/application/file-management/ports/file.repository";

@Injectable()
export class PrismaFileRepository implements FileRepository {
  constructor(
    private prisma: PrismaService,
    private readonly queryService: PrismaQueryService,
  ) {}

  async create(file: File): Promise<File> {
    const data = PrismaFileMapper.toPrisma(file);
    const createdFile = await this.prisma.file.create({ data });
    return PrismaFileMapper.toDomain(createdFile);
  }

  async findById(id: string): Promise<File | null> {
    const file = await this.prisma.file.findUnique({
      where: { id, isDeleted: false },
    });
    return file ? PrismaFileMapper.toDomain(file) : null;
  }

  async findByIds(ids: string[]): Promise<File[]> {
    const files = await this.prisma.file.findMany({
      where: { id: { in: ids }, isDeleted: false },
    });
    return files.map(PrismaFileMapper.toDomain);
  }

  async update(file: File): Promise<File> {
    const data = PrismaFileMapper.toPrismaUpdate(file);
    const updatedFile = await this.prisma.file.update({
      where: { id: file.id.toString() },
      data,
    });
    return PrismaFileMapper.toDomain(updatedFile);
  }

  async delete(id: string): Promise<void> {
    // Hard delete - for soft delete, use update() with file.markAsDeleted()
    await this.prisma.file.delete({ where: { id } });
  }

  async findByIdAndCampus(id: string, campusId: string): Promise<File | null> {
    const file = await this.prisma.file.findFirst({
      where: {
        id,
        campusId,
        isDeleted: false,
      },
    });
    return file ? PrismaFileMapper.toDomain(file) : null;
  }

  async findByCampus(
    campusId: string,
    params: StandardRequest,
  ): Promise<PaginatedResult<File>> {
    // Define allowed fields for filtering and sorting
    params.allowedFilterFields = [
      "filename",
      "mimeType",
      "status",
      "uploadedBy",
      "extension",
      "storageProvider",
      "bucket",
    ];
    params.allowedSortFields = ["createdAt", "updatedAt", "filename", "size"];

    // Use PrismaQueryService to execute query with StandardRequest
    // Campus filter and isDeleted filter are passed in options.where to ensure mandatory scoping
    return await this.queryService.executeQuery<File>(
      this.prisma,
      "file",
      params,
      {
        where: { campusId, isDeleted: false },
      },
      PrismaFileMapper,
    );
  }

  async existsByIdAndCampus(id: string, campusId: string): Promise<boolean> {
    const count = await this.prisma.file.count({
      where: {
        id,
        campusId,
        isDeleted: false,
      },
    });
    return count > 0;
  }

  async findByKey(key: string): Promise<File | null> {
    const file = await this.prisma.file.findFirst({
      where: {
        key,
        isDeleted: false,
      },
    });
    return file ? PrismaFileMapper.toDomain(file) : null;
  }

  async findCleanupCandidates(cutoff: Date, limit: number): Promise<File[]> {
    const files = await this.prisma.file.findMany({
      where: {
        status: { in: [FileStatus.PENDING, FileStatus.ERROR] },
        isDeleted: false,
        updatedAt: { lt: cutoff },
      },
      orderBy: { updatedAt: "asc" },
      take: limit,
    });
    return files.map(PrismaFileMapper.toDomain);
  }

  async transitionStatus(
    id: string,
    expectedStatus: FileStatus,
    nextStatus: FileStatus,
  ): Promise<boolean> {
    const result = await this.prisma.file.updateMany({
      where: { id, status: expectedStatus, isDeleted: false },
      data: { status: nextStatus },
    });
    return result.count === 1;
  }

  async claimStaleForCleanup(
    id: string,
    expectedStatus: FileStatus,
    cutoff: Date,
  ): Promise<Date | null> {
    if (
      expectedStatus !== FileStatus.PENDING &&
      expectedStatus !== FileStatus.ERROR
    ) {
      return null;
    }

    const leaseToken = new Date();
    const result = await this.prisma.file.updateMany({
      where: {
        id,
        status: expectedStatus,
        isDeleted: false,
        updatedAt: { lt: cutoff },
      },
      data: { status: FileStatus.ERROR, updatedAt: leaseToken },
    });
    return result.count === 1 ? leaseToken : null;
  }

  async completeCleanup(id: string, leaseToken: Date): Promise<boolean> {
    const result = await this.prisma.file.updateMany({
      where: {
        id,
        status: FileStatus.ERROR,
        isDeleted: false,
        updatedAt: leaseToken,
      },
      data: { isDeleted: true },
    });
    return result.count === 1;
  }

  async softDeleteIfUnattached(
    id: string,
    campusId: string,
  ): Promise<SoftDeleteFileResult> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM file WHERE id = ${id}::uuid FOR UPDATE`;
      const file = await tx.file.findFirst({
        where: { id, campusId, isDeleted: false },
        select: { id: true },
      });
      if (!file) return "NOT_FOUND";

      const attachment = await tx.attachment.findFirst({
        where: { fileId: id },
        select: { id: true },
      });
      if (attachment) return "ATTACHED";

      const result = await tx.file.updateMany({
        where: { id, campusId, isDeleted: false },
        data: { isDeleted: true },
      });
      return result.count === 1 ? "DELETED" : "NOT_FOUND";
    });
  }
}
