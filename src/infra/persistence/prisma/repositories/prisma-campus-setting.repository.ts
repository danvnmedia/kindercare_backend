import { CampusSettingRepository } from "@/application/content-management/ports/campus-setting.repository";
import { CampusSetting } from "@/domain/content-management";
import { Injectable } from "@nestjs/common";
import { PrismaCampusSettingMapper } from "../mapper/prisma-campus-setting.mapper";
import { PrismaService } from "../prisma.service";

@Injectable()
export class PrismaCampusSettingRepository implements CampusSettingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByCampusId(campusId: string): Promise<CampusSetting | null> {
    const prismaSetting = await this.prisma.campusSetting.findUnique({
      where: { campusId },
    });
    return prismaSetting
      ? PrismaCampusSettingMapper.toDomain(prismaSetting)
      : null;
  }

  async save(setting: CampusSetting): Promise<CampusSetting> {
    const prismaData = PrismaCampusSettingMapper.toPrisma(setting);
    const created = await this.prisma.campusSetting.create({
      data: prismaData,
    });
    return PrismaCampusSettingMapper.toDomain(created);
  }

  async update(setting: CampusSetting): Promise<CampusSetting> {
    const prismaData = PrismaCampusSettingMapper.toPrismaUpdate(setting);
    const updated = await this.prisma.campusSetting.update({
      where: { id: setting.id },
      data: prismaData,
    });
    return PrismaCampusSettingMapper.toDomain(updated);
  }

  async upsert(setting: CampusSetting): Promise<CampusSetting> {
    const createData = PrismaCampusSettingMapper.toPrisma(setting);
    const updateData = PrismaCampusSettingMapper.toPrismaUpdate(setting);

    const upserted = await this.prisma.campusSetting.upsert({
      where: { campusId: setting.campusId },
      create: createData,
      update: updateData,
    });
    return PrismaCampusSettingMapper.toDomain(upserted);
  }
}
