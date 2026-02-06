-- AlterTable: retirer participant_id et team_position; ajouter statPerks, spell casts.
-- riotIdGameName/riotIdTagline du payload → remplissent Player.summoner_name à la collecte, pas stockés ici.
ALTER TABLE "participants" DROP COLUMN IF EXISTS "participant_id",
DROP COLUMN IF EXISTS "team_position",
ADD COLUMN     "spell1_casts" INTEGER,
ADD COLUMN     "spell2_casts" INTEGER,
ADD COLUMN     "spell3_casts" INTEGER,
ADD COLUMN     "spell4_casts" INTEGER,
ADD COLUMN     "summoner1_casts" INTEGER,
ADD COLUMN     "summoner2_casts" INTEGER,
ADD COLUMN     "stat_perks" JSONB;
