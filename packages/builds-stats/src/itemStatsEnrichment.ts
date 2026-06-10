/**
 * Fill missing item stats for gold-value calculation when Data Dragon omits fields.
 * Parsing logic aligned with backend DataDragonService description enrichment.
 */

type ItemStatsRecord = Record<string, number | undefined>;

export type ItemForGoldValueStats = {
  id?: string;
  stats?: ItemStatsRecord;
  description?: string;
  tags?: string[];
  effect?: Record<string, string | undefined>;
};

/** DDragon omits regen on World Atlas (3865); wiki base value = 255g (63.75% of 400g). */
const ITEM_STAT_FALLBACKS: Record<string, ItemStatsRecord> = {
  "3865": {
    FlatHPPoolMod: 30,
    PercentHPRegenMod: 25,
    PercentMPRegenMod: 25,
  },
};

function normalizeStatLabel(label: string): string {
  return label
    .replace(/&nbsp;|&#160;|\u00a0/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function mapDescriptionStatLabelToKey(
  label: string,
  hasPercent: boolean
): string | null {
  if (!label) return null;
  const compact = label.replace(/[^a-z0-9]/g, "");

  if (compact.includes("degatsdattaque") || compact === "ad")
    return "FlatPhysicalDamageMod";
  if (compact.includes("puissance") || compact === "ap") return "FlatMagicDamageMod";
  if (compact.includes("degatsdecoupcritique") || compact.includes("degatscritiques")) {
    return "FlatCritDamageMod";
  }
  if (label.includes("armure")) return "FlatArmorMod";
  if (label.includes("resistance magique") || compact === "rm")
    return "FlatSpellBlockMod";
  if (compact.includes("vitessedattaque")) return "PercentAttackSpeedMod";
  if (label.includes("critique")) return "FlatCritChanceMod";
  if (label.includes("vol de vie")) return "PercentLifeStealMod";
  if (
    label.includes("vol de sort") ||
    label.includes("spell vamp") ||
    label.includes("vampirisme de sort")
  ) {
    return "PercentSpellVampMod";
  }
  if (label.includes("tenacite"))
    return hasPercent ? "PercentTenacity" : "FlatTenacity";
  if (label.includes("lethalite"))
    return hasPercent ? "rPercentLethalityMod" : "FlatLethality";
  if (label.includes("omnivamp")) return "PercentOmnivamp";
  if (
    label.includes("hate") ||
    label.includes("acceleration de competence") ||
    compact.includes("accelerationdecompetence")
  ) {
    return "rFlatCooldownModPerLevel";
  }
  if (label.includes("penetration darmure")) {
    return hasPercent ? "rPercentArmorPenetrationMod" : "rFlatArmorPenetrationMod";
  }
  if (label.includes("penetration magique")) {
    return hasPercent ? "rPercentSpellPenetrationMod" : "rFlatSpellPenetrationMod";
  }
  if (
    compact.includes("efficacitedesoinsetboucliers") ||
    compact.includes("healandshieldpower") ||
    (label.includes("soins") && label.includes("boucliers")) ||
    (label.includes("heal") && label.includes("shield"))
  ) {
    return hasPercent ? "PercentHealShieldPower" : null;
  }
  if (label.includes("mana") && (label.includes("regen") || label.includes("regeneration"))) {
    return hasPercent ? "PercentMPRegenMod" : "FlatMPRegenMod";
  }
  if (
    (label.includes("health") || label.includes("pv") || label.includes("sante")) &&
    (label.includes("regen") || label.includes("regeneration"))
  ) {
    return hasPercent ? "PercentHPRegenMod" : "FlatHPRegenMod";
  }
  if (label.includes("vitesse de deplacement")) {
    return hasPercent ? "PercentMovementSpeedMod" : "FlatMovementSpeedMod";
  }
  if (label.includes("mana")) return "FlatMPPoolMod";
  if (label.includes("pv") || label.includes("sante") || label.includes("health")) {
    return "FlatHPPoolMod";
  }
  if (/\bpo\b/.test(label) && (label.includes("10") || label.includes("sec"))) {
    return "GoldPer10";
  }
  if (label.includes("gold") && label.includes("10")) return "GoldPer10";

  return null;
}

export function parseStatsFromItemDescription(
  description: string
): ItemStatsRecord {
  const out: ItemStatsRecord = {};
  const statsBlocks = Array.from(
    description.matchAll(/<stats>([\s\S]*?)<\/stats>/gi)
  );

  for (const block of statsBlocks) {
    const html = block[1] || "";
    const parts = Array.from(
      html.matchAll(/<attention>\s*([+-]?\d+(?:[.,]\d+)?)(%)?\s*<\/attention>([^<]*)/gi)
    );
    for (const part of parts) {
      const rawValue = part[1];
      const percentInValue = Boolean(part[2]);
      const rawLabel = part[3] || "";
      const numericValue = Number.parseFloat(rawValue.replace(",", "."));
      if (!Number.isFinite(numericValue)) continue;

      const label = normalizeStatLabel(rawLabel);
      const hasPercent =
        percentInValue || rawLabel.includes("%") || label.includes("pourcent");
      const mappedKey = mapDescriptionStatLabelToKey(label, hasPercent);
      if (!mappedKey) continue;

      out[mappedKey] = numericValue;
    }
  }

  return out;
}

function statsFromEffect(item: ItemForGoldValueStats): ItemStatsRecord {
  if (!item.tags?.includes("GoldPer")) return {};
  const raw = item.effect?.Effect1Amount;
  if (raw == null) return {};
  const n = Number.parseFloat(String(raw).replace(",", "."));
  if (!Number.isFinite(n)) return {};
  return { GoldPer10: n };
}

/** Merge fallbacks, description parsing, and effect; existing stats win. */
export function resolveItemStatsForGoldValue(
  item: ItemForGoldValueStats | null | undefined
): ItemStatsRecord {
  if (!item) return {};

  const existing =
    item.stats && typeof item.stats === "object" ? { ...item.stats } : {};
  const fromDescription = parseStatsFromItemDescription(item.description ?? "");
  const fromFallback = item.id ? { ...(ITEM_STAT_FALLBACKS[item.id] ?? {}) } : {};
  const fromEffect = statsFromEffect(item);

  return {
    ...fromFallback,
    ...fromDescription,
    ...fromEffect,
    ...existing,
  };
}
