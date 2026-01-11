import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { CampusRepository } from "@/application/campus/ports/campus.repository";
import { Campus } from "@/domain/campus/entities/campus.entity";
import { PrismaCampusMapper } from "../mapper/prisma-campus.mapper";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";
import { PrismaQueryService } from "@/core/modules/standard-response/services/prisma-query.service";

@Injectable()
export class PrismaCampusRepository implements CampusRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queryService: PrismaQueryService,
  ) {}

  async findById(id: string): Promise<Campus | null> {
    const prismaCampus = await this.prisma.campus.findUnique({
      where: { id },
    });
    return prismaCampus ? PrismaCampusMapper.toDomain(prismaCampus) : null;
  }

  async findByName(name: string): Promise<Campus | null> {
    const prismaCampus = await this.prisma.campus.findFirst({
      where: { name },
    });
    return prismaCampus ? PrismaCampusMapper.toDomain(prismaCampus) : null;
  }

  async findAll(params: StandardRequest): Promise<PaginatedResult<Campus>> {
    params.allowedFilterFields = ["name", "address", "phoneNumber", "isActive"];
    params.allowedSortFields = ["name", "createdAt", "updatedAt", "isActive"];

    return await this.queryService.executeQuery<Campus>(
      this.prisma,
      "campus",
      params,
      {
        orderBy: { name: "asc" },
      },
      PrismaCampusMapper,
    );
  }

  async save(campus: Campus): Promise<Campus> {
    const prismaData = PrismaCampusMapper.toPrisma(campus);
    const created = await this.prisma.campus.create({
      data: prismaData,
    });
    return PrismaCampusMapper.toDomain(created);
  }

  async update(campus: Campus): Promise<Campus> {
    const prismaData = PrismaCampusMapper.toPrismaUpdate(campus);
    const updated = await this.prisma.campus.update({
      where: { id: campus.id },
      data: prismaData,
    });
    return PrismaCampusMapper.toDomain(updated);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.campus.delete({
      where: { id },
    });
  }

  async exists(id: string): Promise<boolean> {
    const count = await this.prisma.campus.count({
      where: { id },
    });
    return count > 0;
  }
}
