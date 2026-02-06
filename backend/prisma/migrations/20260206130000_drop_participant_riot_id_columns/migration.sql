
-- AlterTable: retirer riot_id_game_name et riot_id_tagline de participants (remplissent Player.summoner_name à la collecte, pas stockés ici).
ALTER TABLE "participants" DROP COLUMN IF EXISTS "riot_id_game_name",
DROP COLUMN IF EXISTS "riot_id_tagline";
