import {
  Injectable,
  Inject,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import {
  CampusSetting,
  UpdateCampusSettingData,
} from "@/domain/content-management";
import { CampusSettingRepository } from "../../ports/campus-setting.repository";

export interface UpdateCampusSettingInput {
  requireTeacherApproval?: boolean;
  maxPinnedPosts?: number;
  allowParentComments?: boolean;
  allowReactions?: boolean;
}

@Injectable()
export class UpdateCampusSettingUseCase {
  private readonly logger = new Logger(UpdateCampusSettingUseCase.name);

  constructor(
    @Inject("CAMPUS_SETTING_REPOSITORY")
    private readonly campusSettingRepository: CampusSettingRepository,
  ) {}

  /**
   * Update campus settings for a given campus.
   * If settings don't exist, creates with defaults then updates.
   * Only updates provided fields.
   * @param campusId - The campus ID to update settings for.
   * @param input - The settings to update.
   * @returns The updated campus settings.
   */
  async execute(
    campusId: string,
    input: UpdateCampusSettingInput,
  ): Promise<CampusSetting> {
    try {
      this.logger.log(`Updating campus settings for campus: ${campusId}`);

      // Get existing settings or create default
      let settings =
        await this.campusSettingRepository.findByCampusId(campusId);

      if (!settings) {
        this.logger.log(
          `No settings found, creating default for campus: ${campusId}`,
        );
        settings = CampusSetting.create({ campusId });
      }

      // Build update data with only provided fields
      const updateData: UpdateCampusSettingData = {};

      if (input.requireTeacherApproval !== undefined) {
        updateData.requireTeacherApproval = input.requireTeacherApproval;
      }
      if (input.maxPinnedPosts !== undefined) {
        updateData.maxPinnedPosts = input.maxPinnedPosts;
      }
      if (input.allowParentComments !== undefined) {
        updateData.allowParentComments = input.allowParentComments;
      }
      if (input.allowReactions !== undefined) {
        updateData.allowReactions = input.allowReactions;
      }

      // Update domain entity (validation happens in entity)
      settings.update(updateData);

      // Use upsert to handle both create and update cases
      const updatedSettings =
        await this.campusSettingRepository.upsert(settings);

      this.logger.log(`Campus settings updated for campus: ${campusId}`);
      return updatedSettings;
    } catch (error) {
      this.logger.error(
        `Failed to update campus settings: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(error.message);
    }
  }
}
