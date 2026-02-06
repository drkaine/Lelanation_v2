-- À exécuter une fois pour corriger le drift sans reset (sans perte de données).
-- Puis lancer: npx prisma migrate resolve --applied 20260206130000_drop_participant_riot_id_columns

-- 1) Supprimer les colonnes riot_id de participants
ALTER TABLE "participants" DROP COLUMN IF EXISTS "riot_id_game_name", DROP COLUMN IF EXISTS "riot_id_tagline";

-- 2) Mettre à jour le checksum de la migration 20260206120000 pour qu'il corresponde au fichier actuel
--    (évite "The migration was modified after it was applied")
UPDATE "_prisma_migrations"
SET "checksum" = 'e8124d2e0d0635cf46978ee0f17f62e98a50b442a11083d313c62a4ac4671eff'
WHERE "migration_name" = '20260206120000_participant_cleanup_riot_stat_perks_spell_casts';
