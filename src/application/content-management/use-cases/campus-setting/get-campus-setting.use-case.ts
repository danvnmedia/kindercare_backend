import { Injectable, Inject, Logger } from "@nestjs/common";
import { CampusSetting } from "@/domain/content-management";
import { CampusSettingRepository } from "../../ports/campus-setting.repository";

@Injectable()
export class GetCampusSettingUseCase {
  private readonly logger = new Logger(GetCampusSettingUseCase.name);

  constructor(
    @Inject("CAMPUS_SETTING_REPOSITORY")
    private readonly campusSettingRepository: CampusSettingRepository,
  ) {}

  /**
   * Get campus settings for a given campus.
   * If settings don't exist, creates and returns default settings.
   * @param campusId - The campus ID to get settings for.
   * @returns The campus settings.
   */
  async execute(campusId: string): Promise<CampusSetting> {
    this.logger.log(`Getting campus settings for campus: ${campusId}`);

    // Try to find existing settings
    const existingSettings =
      await this.campusSettingRepository.findByCampusId(campusId);

    if (existingSettings) {
      this.logger.log(`Found existing settings for campus: ${campusId}`);
      return existingSettings;
    }

    // Create default settings if none exist
    this.logger.log(`Creating default settings for campus: ${campusId}`);
    const defaultSettings = CampusSetting.create({ campusId });
    const savedSettings =
      await this.campusSettingRepository.save(defaultSettings);

    this.logger.log(`Default settings created for campus: ${campusId}`);
    return savedSettings;
  }
}
