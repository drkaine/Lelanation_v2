/** Shape returned by Tauri `companion_get_config` / `companion_save_config`. */
export interface CompanionConfig {
  leagueInstallPath: string | null;
  onboardingComplete: boolean;
  shareRankedDuoStats: boolean;
}
