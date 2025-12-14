import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { FileRepository } from "../../../../application/file-management/ports/file.repository";
import { File } from "../../../../domain/file-management/entities/file.entity";
import { PrismaFileMapper } from "../mapper/prisma-file.mapper";

@Injectable()
export class PrismaFileRepository implements FileRepository {
  constructor(private prisma: PrismaService) {}

  async create(file: File): Promise<File> {
    const data = PrismaFileMapper.toPrisma(file);
    const createdFile = await this.prisma.file.create({ data });
    return PrismaFileMapper.toDomain(createdFile);
  }

  async findById(id: string): Promise<File | null> {
    const file = await this.prisma.file.findUnique({ where: { id } });
    return file ? PrismaFileMapper.toDomain(file) : null;
  }

  async findByIds(ids: string[]): Promise<File[]> {
    const files = await this.prisma.file.findMany({
      where: { id: { in: ids } },
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
    // Soft delete - handled by calling file.markAsDeleted() and update()
    // This method is kept for hard deletion if needed
    await this.prisma.file.delete({ where: { id } });
  }
}
