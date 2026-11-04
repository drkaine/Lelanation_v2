export type BanRoleColumn =
  | "count_banner_top"
  | "count_banner_jungle"
  | "count_banner_mid"
  | "count_banner_adc"
  | "count_banner_support";

const ROLE_TO_COLUMN: Record<string, BanRoleColumn> = {
  top: "count_banner_top",
  jungle: "count_banner_jungle",
  mid: "count_banner_mid",
  middle: "count_banner_mid",
  adc: "count_banner_adc",
  bottom: "count_banner_adc",
  support: "count_banner_support",
  utility: "count_banner_support",
};

/** Maps a participant role (Riot TOP/JUNGLE/MIDDLE/BOTTOM/UTILITY or legacy mid/adc/support) to its ban column. */
export function banRoleColumn(role: string): BanRoleColumn | null {
  return ROLE_TO_COLUMN[role.trim().toLowerCase()] ?? null;
}
