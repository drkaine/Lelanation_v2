-- `participants` ne stockait jamais les dégâts infligés aux champions ni les dégâts
-- auto-mitigés (participant.physicalDamageDealtToChampions / magicDamageDealtToChampions /
-- trueDamageDealtToChampions / damageSelfMitigated côté Riot match-v5), alors que
-- `champion_stats.sum_*_done_to_champions` / `sum_damage_self_mitigated` existent depuis la
-- migration 0000 : ces colonnes sont à 0 pour toutes les parties ingérées jusqu'ici.

ALTER TABLE participants
  ADD COLUMN IF NOT EXISTS physical_damage_dealt_to_champions INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS magic_damage_dealt_to_champions INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS true_damage_dealt_to_champions INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS damage_self_mitigated INTEGER NOT NULL DEFAULT 0;
