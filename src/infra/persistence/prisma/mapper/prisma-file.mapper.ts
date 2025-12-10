import { UniqueEntityID } from '../../../../core/entities/unique-entity-id';
import { File as DomainFile } from '../../../../domain/file-management/entities/file.entity';
import { File as PrismaFile } from '@prisma/client';

export class PrismaFileMapper {
  static toDomain(prismaFile: PrismaFile): DomainFile {
    return DomainFile.create(
      {
        key: prismaFile.key,
        filename: prismaFile.filename,
        mimeType: prismaFile.mimeType,
        size: prismaFile.size,
        status: prismaFile.status as 'PENDING' | 'ACTIVE' | 'DELETED',
        uploadedBy: new UniqueEntityID(prismaFile.uploadedBy),
        createdAt: prismaFile.createdAt,
        updatedAt: prismaFile.updatedAt,
      },
      new UniqueEntityID(prismaFile.id),
    );
  }

  static toPrisma(domainFile: DomainFile): PrismaFile {
    return {
      id: domainFile.id.toString(),
      key: domainFile.key,
      filename: domainFile.filename,
      mimeType: domainFile.mimeType,
      size: domainFile.size,
      status: domainFile.status,
      uploadedBy: domainFile.uploadedBy.toString(),
      createdAt: domainFile.createdAt,
      updatedAt: domainFile.updatedAt,
    };
  }
}
