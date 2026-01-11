/**
 * CampusSetting Repository Port (Interface)
 * Defines the contract for campus setting data access
 * Implementation will be provided by infrastructure layer
 */

import { CampusSetting } from "@/domain/content-management";

export abstract class CampusSettingRepository {
  /**
   * Find settings for a campus
   * Returns null if no settings exist (use defaults)
   */
  abstract findByCampusId(campusId: string): Promise<CampusSetting | null>;

  /**
   * Save new campus settings (create)
   */
  abstract save(setting: CampusSetting): Promise<CampusSetting>;

  /**
   * Update existing campus settings
   */
  abstract update(setting: CampusSetting): Promise<CampusSetting>;

  /**
   * Upsert campus settings (create if not exists, update if exists)
   * Convenience method for settings that should always exist
   */
  abstract upsert(setting: CampusSetting): Promise<CampusSetting>;
}
