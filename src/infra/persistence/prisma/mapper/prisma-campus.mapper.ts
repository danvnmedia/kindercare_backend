import { Campus as PrismaCampus } from "@prisma/client";
import { Campus } from "@/domain/campus/entities/campus.entity";
import { Prisma } from "@prisma/client";

export class PrismaCampusMapper {
  static toDomain(prismaCampus: PrismaCampus): Campus {
    return Campus.create(
      {
        name: prismaCampus.name,
        address: prismaCampus.address,
        phoneNumber: prismaCampus.phoneNumber,
        isActive: prismaCampus.isActive,
        createdAt: prismaCampus.createdAt,
        updatedAt: prismaCampus.updatedAt,
      },
      prismaCampus.id,
    );
  }

  static toPrisma(campus: Campus): Prisma.CampusUncheckedCreateInput {
    return {
      id: campus.id,
      name: campus.name,
      address: campus.address,
      phoneNumber: campus.phoneNumber,
      isActive: campus.isActive,
      createdAt: campus.createdAt,
      updatedAt: campus.updatedAt,
    };
  }

  static toPrismaUpdate(campus: Campus): Prisma.CampusUpdateInput {
    return {
      name: campus.name,
      address: campus.address,
      phoneNumber: campus.phoneNumber,
      isActive: campus.isActive,
      updatedAt: campus.updatedAt,
    };
  }

  static toDomainArray(prismaCampuses: PrismaCampus[]): Campus[] {
    return prismaCampuses.map((c) => PrismaCampusMapper.toDomain(c));
  }
}
