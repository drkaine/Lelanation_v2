-- AlterTable
ALTER TABLE "matches" ADD COLUMN     "end_of_game_result" TEXT,
ADD COLUMN     "teams" JSONB;

-- AlterTable
ALTER TABLE "participants" ADD COLUMN     "challenges" JSONB,
ADD COLUMN     "champ_level" INTEGER,
ADD COLUMN     "first_blood_assist" BOOLEAN,
ADD COLUMN     "first_blood_kill" BOOLEAN,
ADD COLUMN     "game_ended_in_surrender" BOOLEAN,
ADD COLUMN     "gold_earned" INTEGER,
ADD COLUMN     "participant_id" INTEGER,
ADD COLUMN     "total_damage_dealt_to_champions" INTEGER,
ADD COLUMN     "total_minions_killed" INTEGER,
ADD COLUMN     "vision_score" INTEGER;

-- CreateIndex
CREATE INDEX "matches_end_of_game_result_idx" ON "matches"("end_of_game_result");

-- CreateIndex
CREATE INDEX "participants_game_ended_in_surrender_idx" ON "participants"("game_ended_in_surrender");
