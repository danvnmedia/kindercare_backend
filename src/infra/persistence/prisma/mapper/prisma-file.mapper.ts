import { UniqueEntityID } from "../../../../core/entities/unique-entity-id";
import { File as DomainFile } from "../../../../domain/file-management/entities/file.entity";
import { FileStatus } from "../../../../domain/file-management/enums/file-status.enum";
import { FilePurpose } from "../../../../domain/file-management/enums/file-purpose.enum";
import { FileAudienceType } from "../../../../domain/file-management/enums/file-audience-type.enum";
import { File as PrismaFile, Prisma } from "@prisma/client";

export class PrismaFileMapper {
  /**
   * Convert Prisma model to Domain entity (full)
   */
  static toDomain(prismaFile: PrismaFile): DomainFile {
    return DomainFile.create(
      {
        key: prismaFile.key,
        bucket: prismaFile.bucket,
        storageProvider: prismaFile.storageProvider,
        filename: prismaFile.filename,
        mimeType: prismaFile.mimeType,
        size: prismaFile.size,
        extension: prismaFile.extension,
        purpose: prismaFile.purpose as FilePurpose,
        audienceType: prismaFile.audienceType as FileAudienceType | null,
        audienceId: prismaFile.audienceId,
        classId: prismaFile.classId,
        gradeLevelId: prismaFile.gradeLevelId,
        status: prismaFile.status as FileStatus,
        uploadedBy: prismaFile.uploadedBy,
        campusId: prismaFile.campusId,
        isDeleted: prismaFile.isDeleted,
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
        bucket: prismaFile.bucket,
        storageProvider: prismaFile.storageProvider,
        filename: prismaFile.filename,
        mimeType: prismaFile.mimeType,
        size: prismaFile.size,
        extension: prismaFile.extension,
        purpose: prismaFile.purpose as FilePurpose,
        audienceType: prismaFile.audienceType as FileAudienceType | null,
        audienceId: prismaFile.audienceId,
        classId: prismaFile.classId,
        gradeLevelId: prismaFile.gradeLevelId,
        status: prismaFile.status as FileStatus,
        uploadedBy: prismaFile.uploadedBy,
        campusId: prismaFile.campusId,
        isDeleted: prismaFile.isDeleted,
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
      bucket: domainFile.bucket,
      storageProvider: domainFile.storageProvider,
      filename: domainFile.filename,
      mimeType: domainFile.mimeType,
      size: domainFile.size,
      extension: domainFile.extension,
      purpose: domainFile.purpose,
      audienceType: domainFile.audienceType,
      audienceId: domainFile.audienceId,
      classId: domainFile.classId,
      gradeLevelId: domainFile.gradeLevelId,
      status: domainFile.status,
      uploadedBy: domainFile.uploadedBy,
      campusId: domainFile.campusId,
      isDeleted: domainFile.isDeleted,
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
      isDeleted: domainFile.isDeleted,
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
