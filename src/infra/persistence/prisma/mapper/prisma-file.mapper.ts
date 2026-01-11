import { UniqueEntityID } from "../../../../core/entities/unique-entity-id";
import { File as DomainFile } from "../../../../domain/file-management/entities/file.entity";
import { File as PrismaFile, Prisma } from "@prisma/client";

export class PrismaFileMapper {
  /**
   * Convert Prisma model to Domain entity (full)
   */
  static toDomain(prismaFile: PrismaFile): DomainFile {
    return DomainFile.create(
      {
        key: prismaFile.key,
        filename: prismaFile.filename,
        mimeType: prismaFile.mimeType,
        size: prismaFile.size,
        status: prismaFile.status as "PENDING" | "ACTIVE" | "DELETED",
        uploadedBy: prismaFile.uploadedBy,
        campusId: prismaFile.campusId,
        createdAt: prismaFile.createdAt,
        updatedAt: prismaFile.updatedAt,
      },
      prismaFile.id,
    );
  }

  /**
   * Convert Prisma model to Domain entity (without nested relations)
   * Use to prevent circular references
   */
  static toDomainSimple(prismaFile: PrismaFile): DomainFile {
    return DomainFile.create(
      {
        key: prismaFile.key,
        filename: prismaFile.filename,
        mimeType: prismaFile.mimeType,
        size: prismaFile.size,
        status: prismaFile.status as "PENDING" | "ACTIVE" | "DELETED",
        uploadedBy: prismaFile.uploadedBy,
        campusId: prismaFile.campusId,
        createdAt: prismaFile.createdAt,
        updatedAt: prismaFile.updatedAt,
      },
      prismaFile.id,
    );
  }

  /**
   * Convert Domain entity to Prisma create input
   */
  static toPrisma(domainFile: DomainFile): Prisma.FileUncheckedCreateInput {
    return {
      id: domainFile.id.toString(),
      key: domainFile.key,
      filename: domainFile.filename,
      mimeType: domainFile.mimeType,
      size: domainFile.size,
      status: domainFile.status,
      uploadedBy: domainFile.uploadedBy.toString(),
      campusId: domainFile.campusId,
      createdAt: domainFile.createdAt,
      updatedAt: domainFile.updatedAt,
    };
  }

  /**
   * Convert Domain entity to Prisma update input
   */
  static toPrismaUpdate(domainFile: DomainFile): Prisma.FileUpdateInput {
    return {
      status: domainFile.status,
      updatedAt: domainFile.updatedAt,
    };
  }

  /**
   * Convert array of Prisma models to Domain entities
   */
  static toDomainArray(prismaFiles: PrismaFile[]): DomainFile[] {
    return prismaFiles.map((prismaFile) =>
      PrismaFileMapper.toDomain(prismaFile),
    );
  }
}
