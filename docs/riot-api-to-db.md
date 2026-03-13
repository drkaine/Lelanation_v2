# Liste des valeurs Riot API sauvegardées en base

Liste exhaustive de toutes les colonnes / champs remplis à partir des réponses Riot (match detail, timeline, account, league).

**Sources des explications :** [Riot Developer Portal – Match-v5](https://developer.riotgames.com/apis#match-v5), [changelog match-v5 (RiotTuxedo)](https://gist.github.com/RiotTuxedo/758ee4d88693b768a880ece93cd78663) et références communautaires (ex. RiotNet) lorsque la doc officielle ne détaille pas tous les champs.

---

## Signification des valeurs

### Match & équipes

- **match_id** — Identifiant unique du match côté Riot (ex. `EUW1_1234567890`).
- **game_version** — Version du client LoL (ex. `14.5.123.1234`).
- **game_duration** — Durée de la partie en secondes.
- **rank** — Rang moyen des joueurs du match (ex. `GOLD_II`), calculé à partir des rangs Solo/Duo des participants.
- **game_ended_in_surrender** — Au moins un participant a voté / la partie s’est terminée par abandon.
- **game_ended_in_early_surrender** — Abandon avant la fin du délai habituel (early surrender).
- **team_id** — 100 = équipe bleue, 200 = équipe rouge.
- **win** — true si l’équipe (ou le participant) a gagné la partie.
- **rank_tier** (équipe) — Rang moyen des 5 joueurs de l’équipe.
- **team_early_surrendered** — L’équipe a initié un early surrender.
- **ban_1 … ban_5** — ChampionId des bans, dans l’ordre de ban (pick_order 1–5).
- **baron_first** — Cette équipe a tué le premier Baron.
- **baron_kills** — Nombre de Barons tués par l’équipe.
- **dragon_first**, **dragon_kills** — Idem pour les dragons.
- **tower_first**, **tower_kills** — Première tour détruite / nombre de tours détruites.
- **horde** — Horde de Void Grubs (objectif top).
- **rift_herald_first**, **rift_herald_kills** — Héraut de la faille.
- **inhibitor_first**, **inhibitor_kills** — Inhibiteurs.
- **champion_first**, **champion_kills** — Premier kill de champion / nombre de kills de champions (au niveau équipe).

### Participants – identité & rôle

- **puuid** — Identifiant compte Riot (persistant, utilisé par l’API).
- **champion_id** — ID du champion joué (référence Data Dragon / CDragon).
- **role** — Position jouée : TOP, JUNGLE, MIDDLE, BOTTOM, SUPPORT. Dérivé de `individualPosition` / `teamPosition` (Riot : *teamPosition* = meilleure estimation avec contrainte “un joueur par rôle”).
- **rank_tier**, **rank_division**, **rank_lp** — Rang Solo/Duo en fin de partie (ex. GOLD, II, 42 LP) ; peut être complété via League v4 en backfill.

### Participants – KDA, or, dégâts, vision

- **kills**, **deaths**, **assists** — Nombre de kills, morts et assists du participant.
- **champ_level** — Niveau du champion en fin de partie.
- **gold_earned** — Or total gagné pendant la partie.
- **gold_spent** — Or dépensé (achats).
- **total_damage_dealt_to_champions** — Dégâts totaux infligés aux champions ennemis.
- **total_damage_dealt** — Dégâts totaux infligés (toutes cibles).
- **total_damage_taken** — Dégâts totaux reçus.
- **total_minions_killed** — Crédits (minions) tués.
- **vision_score** — Score de vision (wards, révélations, etc.).

### Participants – first blood / first tower

- **first_blood_kill** — Le participant a réalisé le premier kill de la partie.
- **first_blood_assist** — Le participant a assisté le premier kill.
- **first_tower_kill** — Le participant a détruit la première tour.
- **first_tower_assist** — Le participant a assisté la destruction de la première tour.

### Participants – objectifs & dégâts spéciaux

- **baron_kills**, **dragon_kills** — Participations aux kills Baron / Dragon (comptage côté participant).
- **damage_dealt_to_objectives** — Dégâts aux objectifs (dragon, baron, etc.).
- **damage_dealt_to_turrets** — Dégâts aux tours.
- **damage_dealt_to_buildings** — Dégâts aux structures (tours, inhibiteurs).
- **damage_dealt_to_epic_monsters** — Dégâts aux monstres épiques.
- **damage_self_mitigated** — Dégâts évités / absorbés (boucliers, armure, etc.).
- **inhibitor_kills**, **inhibitor_takedowns**, **inhibitors_lost** — Inhibiteurs détruits / participations / inhibiteurs perdus.
- **objectives_stolen** — Objectifs “volés” (ex. dragon/baron volé à l’équipe adverse).
- **objectives_stolen_assists** — Participations à ces vols.
- **turret_kills**, **turret_takedowns**, **turrets_lost** — Tours détruites / participations / tours perdues.

### Participants – dégâts par type

- **magic_damage_dealt**, **physical_damage_dealt**, **true_damage_dealt** — Dégâts magiques / physiques / purs infligés.
- **magic_damage_dealt_to_champions**, etc. — Même chose en ciblant uniquement les champions.
- **magic_damage_taken**, **physical_damage_taken**, **true_damage_taken** — Dégâts reçus par type.

### Participants – multi-kills & séries

- **double_kills**, **triple_kills**, **quadra_kills**, **penta_kills** — Nombre de doubles, triples, quadra et pentakills.
- **unreal_kills** — Kills au-delà du pentakill (ex. hexakill en mode spécial).
- **killing_sprees** — Nombre de séries de kills (au moins 3 kills sans mourir).
- **largest_killing_spree** — Plus longue série de kills.
- **largest_multi_kill** — Plus gros multi-kill (2 = double, 5 = penta).
- **largest_critical_strike** — Plus gros coup critique infligé.

### Participants – soins, bouclier, CC

- **total_heal** — Soins totaux appliqués (à soi, alliés, etc.).
- **total_heals_on_teammates** — Soins appliqués uniquement aux alliés (post-mitigation).
- **total_units_healed** — Nombre d’unités soignées.
- **total_damage_shielded_on_teammates** — Dégâts absorbés par des boucliers donnés aux alliés.
- **time_ccing_others** — Temps pendant lequel le participant a contrôlé des ennemis (stun, slow, etc.).
- **total_time_cc_dealt** — Durée totale de CC infligée (en ms ou unité Riot).
- **total_time_spent_dead** — Temps passé mort.
- **longest_time_spent_living** — Plus longue période en vie sans mourir.

### Participants – jungle & farm

- **neutral_minions_killed** — Monstres neutres tués (jungle, crabes, etc.).
- **total_ally_jungle_minions_killed** — Camps tués dans la jungle alliée.
- **total_enemy_jungle_minions_killed** — Camps tués dans la jungle ennemie.

### Participants – wards & achats

- **wards_placed**, **wards_killed** — Sentinelles posées / détruites.
- **vision_wards_bought_in_game** — Contrôle achetés (pink wards).
- **sight_wards_bought_in_game** — Sentinelles jaunes achetées.
- **consumables_purchased**, **items_purchased** — Nombre d’objets consommables / d’objets achetés.
- **role_bound_item** — Objet lié au rôle (ex. support item).

### Participants – sorts & runes

- **spell1_casts … spell4_casts** — Nombre d’utilisations des sorts Q, W, E, R (champion).
- **summoner1_casts**, **summoner2_casts** — Nombre d’utilisations des deux sorts de l’invocateur.
- **items** (JSON) — Liste des ID d’objets en fin de partie (slots 0–6, 6 = trinket).
- **runes** (JSON) — Arbre de runes (perks.styles, selections).
- **stat_perks** — IDs des perks de stat (défense, flex, offense).

### Challenges (colonnes ch_*)

Les **challenges** sont des indicateurs optionnels fournis par Riot (ex. “soloKills”, “takedowns”, “earliestBaron”). Chaque clé de l’allowlist est stockée dans une colonne dédiée (`ch_*`) ; la valeur est en général un nombre (Float). Les noms des clés sont documentés / évoluent avec le jeu ; les clés inconnues sont enregistrées dans `challenge_keys_registry` pour détection et notification.

### Timeline – drakes, ordre des skills, starter

- **match_teams_drake.drake_type** — Type du dragon (ex. FIRE_DRAGON, WATER_DRAGON, ELDER_DRAGON).
- **match_teams_drake.soul** — Nom de l’âme accordée à l’équipe (ex. Infernal) quand l’événement DRAGON_SOUL_GIVEN se produit.
- **match_teams_drake.order** — Ordre global du kill de dragon dans la partie (1 = premier dragon tué).
- **participant_spell_orders** — Ordre dans lequel le joueur a monté ses compétences (SKILL_LEVEL_UP) : spell_slot 1–4 = Q–R, order = 1-based.
- **participant_items.starter** — true si cet objet est le premier acheté (hors wards/trinkets), d’après l’événement ITEM_PURCHASED dans la timeline.
- **participant_jungle_first_clear** — Ordre des camps de jungle tués pendant le premier clear (jungleMinionsKilled par frame), pour les joueurs en rôle JUNGLE.

---

## Détail des tables (colonnes ↔ source Riot)

### `matches`

| Colonne | Source Riot |
|--------|-------------|
| match_id | metadata.matchId |
| game_version | info.gameVersion |
| game_duration | info.gameDuration |
| rank | Moyenne des rangs participants (tier, rank, leaguePoints) |
| game_ended_in_surrender | BOOL_OR sur participants[].gameEndedInSurrender |
| game_ended_in_early_surrender | BOOL_OR sur participants[].gameEndedInEarlySurrender |

---

### `match_teams`

| Colonne | Source Riot |
|--------|-------------|
| match_id | — |
| team_id | teams[].teamId (100 / 200) |
| win | teams[].win |
| rank_tier | Moyenne des rank des 5 participants de l’équipe |
| team_early_surrendered | Agrégat participants de l’équipe |
| ban_1 … ban_5 | teams[].bans[0..4].championId |
| baron_first, baron_kills | teams[].objectives.baron |
| dragon_first, dragon_kills | teams[].objectives.dragon |
| tower_first, tower_kills | teams[].objectives.tower |
| horde_first, horde_kills | teams[].objectives.horde |
| rift_herald_first, rift_herald_kills | teams[].objectives.riftHerald |
| inhibitor_first, inhibitor_kills | teams[].objectives.inhibitor |
| champion_first, champion_kills | teams[].objectives.champion |

---

### `bans`

| Colonne | Source Riot |
|--------|-------------|
| match_team_id | — |
| match_id | — |
| champion_id | teams[].bans[].championId |
| pick_order | 1–5 (ordre du ban) |

### `match_team_first_objectives`

Source unique pour « qui a eu le kill / l’assist » sur les objectifs « first » (évite la redondance 10× dans participants).

| Colonne | Source Riot |
|--------|-------------|
| match_team_id | Équipe concernée (l’équipe qui a eu le first) |
| objective_type | `champion` (first blood), `tower` (first tower) ; extensible à `dragon`, `baron`, `horde`, `rift_herald` via timeline |
| participant_id | participants[].id (celui qui a fait le kill ou l’assist) |
| is_kill | true = kill, false = assist |

---

### `players`

| Colonne | Source Riot |
|--------|-------------|
| puuid | participants[].puuid (création) ou Account v1 (résolution) |
| region | Paramètre poller (euw1 / eun1) |
| game_name, tag_name | 

---

### `participants` (colonnes scalaires)

### Identité / équipe / rang

| Colonne | Source Riot |
|--------|-------------|
| player_id | Lien joueur (puuid) |
| match_id | — |
| team_id | participants[].teamId |
| champion_id | participants[].championId |
| win | participants[].win |
| role | Dérivé de individualPosition / teamPosition (TOP, JUNGLE, MIDDLE, BOTTOM, SUPPORT) |
| rank_tier | participants[].tier ou rankTier ; ou League v4 (backfill) |
| rank_division | participants[].rank ou rankDivision ; ou League v4 |
| rank_lp | participants[].leaguePoints ou rankLp ; ou League v4 |

### KDA / or / dégâts / vision

| Colonne | Source Riot |
|--------|-------------|
| kills | participants[].kills |
| deaths | participants[].deaths |
| assists | participants[].assists |
| champ_level | participants[].champLevel |
| gold_earned | participants[].goldEarned |
| gold_spent | participants[].goldSpent |
| total_damage_dealt_to_champions | participants[].totalDamageDealtToChampions |
| total_damage_dealt | participants[].totalDamageDealt |
| total_damage_taken | participants[].totalDamageTaken |
| total_minions_killed | participants[].totalMinionsKilled |
| vision_score | participants[].visionScore |

### First blood / first tower (source unique : match_teams + match_team_first_objectives)

- **match_teams** : `champion_first`, `tower_first` (équipe qui a eu le first blood / first tower).
- **match_team_first_objectives** : qui a fait le kill ou l’assist — une ligne par (équipe, type d’objectif, participant, is_kill). Types : `champion` (first blood), `tower` (first tower). Source Riot : participants[].firstBloodKill / firstBloodAssist / firstTowerKill / firstTowerAssist.

### Surrender

| Colonne | Source Riot |
|--------|-------------|
| game_ended_in_surrender | participants[].gameEndedInSurrender |
| game_ended_in_early_surrender | participants[].gameEndedInEarlySurrender |
| team_early_surrendered | participants[].teamEarlySurrendered |

### Objectifs / dégâts spéciaux

| Colonne | Source Riot |
|--------|-------------|
| baron_kills | participants[].baronKills |
| dragon_kills | participants[].dragonKills |
| damage_dealt_to_buildings | participants[].damageDealtToBuildings |
| damage_dealt_to_epic_monsters | participants[].damageDealtToEpicMonsters |
| damage_dealt_to_objectives | participants[].damageDealtToObjectives |
| damage_dealt_to_turrets | participants[].damageDealtToTurrets |
| damage_self_mitigated | participants[].damageSelfMitigated |
| inhibitor_kills | participants[].inhibitorKills |
| inhibitor_takedowns | participants[].inhibitorTakedowns |
| inhibitors_lost | participants[].inhibitorsLost |
| objectives_stolen | participants[].objectivesStolen |
| objectives_stolen_assists | participants[].objectivesStolenAssists |
| turret_kills | participants[].turretKills |
| turret_takedowns | participants[].turretTakedowns |
| turrets_lost | participants[].turretsLost |

### Dégâts par type

| Colonne | Source Riot |
|--------|-------------|
| magic_damage_dealt | participants[].magicDamageDealt |
| magic_damage_dealt_to_champions | participants[].magicDamageDealtToChampions |
| magic_damage_taken | participants[].magicDamageTaken |
| physical_damage_dealt | participants[].physicalDamageDealt |
| physical_damage_dealt_to_champions | participants[].physicalDamageDealtToChampions |
| physical_damage_taken | participants[].physicalDamageTaken |
| true_damage_dealt | participants[].trueDamageDealt |
| true_damage_dealt_to_champions | participants[].trueDamageDealtToChampions |
| true_damage_taken | participants[].trueDamageTaken |

### Multi-kills / séries

| Colonne | Source Riot |
|--------|-------------|
| double_kills | participants[].doubleKills |
| triple_kills | participants[].tripleKills |
| quadra_kills | participants[].quadraKills |
| penta_kills | participants[].pentaKills |
| unreal_kills | participants[].unrealKills |
| killing_sprees | participants[].killingSprees |
| largest_killing_spree | participants[].largestKillingSpree |
| largest_multi_kill | participants[].largestMultiKill |
| largest_critical_strike | participants[].largestCriticalStrike |

### Soins / bouclier / CC

| Colonne | Source Riot |
|--------|-------------|
| total_heal | participants[].totalHeal |
| total_heals_on_teammates | participants[].totalHealsOnTeammates |
| total_units_healed | participants[].totalUnitsHealed |
| total_damage_shielded_on_teammates | participants[].totalDamageShieldedOnTeammates |
| time_ccing_others | participants[].timeCCingOthers |
| total_time_cc_dealt | participants[].totalTimeCCDealt |
| total_time_spent_dead | participants[].totalTimeSpentDead |
| longest_time_spent_living | participants[].longestTimeSpentLiving |

### Jungle / farm

| Colonne | Source Riot |
|--------|-------------|
| neutral_minions_killed | participants[].neutralMinionsKilled |
| total_ally_jungle_minions_killed | participants[].totalAllyJungleMinionsKilled |
| total_enemy_jungle_minions_killed | participants[].totalEnemyJungleMinionsKilled |

### Wards / items consommables

| Colonne | Source Riot |
|--------|-------------|
| wards_placed | participants[].wardsPlaced |
| wards_killed | participants[].wardsKilled |
| vision_wards_bought_in_game | participants[].visionWardsBoughtInGame |
| sight_wards_bought_in_game | participants[].sightWardsBoughtInGame |
| consumables_purchased | participants[].consumablesPurchased |
| items_purchased | participants[].itemsPurchased |
| role_bound_item | participants[].roleBoundItem |

### Divers participant

| Colonne | Source Riot |
|--------|-------------|
| placement | participants[].placement |
| spell1_casts … spell4_casts | participants[].spell1Casts … spell4Casts |
| summoner1_casts, summoner2_casts | participants[].summoner1Casts, summoner2Casts |
| items (JSON) | participants[].items |
| runes (JSON) | participants[].perks / runes |
| summoner_spells (JSON) | [summoner1Id, summoner2Id] |
| stat_perks (JSON) | participants[].perks.statPerks |
| challenges (JSON) | participants[].challenges |

---

### `participants` — colonnes challenges (allowlist)

Chaque clé allowlist de `challenges` est stockée dans une colonne `ch_*` (Float) :

| Colonne DB | Clé Riot (challenges) |
|------------|------------------------|
| ch_solo_kills | soloKills |
| ch_takedowns | takedowns |
| ch_bounty_gold | bountyGold |
| ch_double_aces | doubleAces |
| ch_buffs_stolen | buffsStolen |
| ch_flawless_aces | flawlessAces |
| ch_had_open_nexus | hadOpenNexus |
| ch_quick_cleanse | quickCleanse |
| ch_snowballs_hit | snowballsHit |
| ch_wards_guarded | wardsGuarded |
| ch_earliest_baron | earliestBaron |
| ch_skillshots_hit | skillshotsHit |
| ch_unseen_recalls | unseenRecalls |
| ch_max_kill_deficit | maxKillDeficit |
| ch_quick_solo_kills | quickSoloKills |
| ch_solo_baron_kills | soloBaronKills |
| ch_void_monster_kill | voidMonsterKill |
| ch_full_team_takedown | fullTeamTakedown |
| ch_initial_buff_count | initialBuffCount |
| ch_initial_crab_count | initialCrabCount |
| ch_outnumbered_kills | outnumberedKills |
| ch_pick_kill_with_ally | pickKillWithAlly |
| ch_quick_first_turret | quickFirstTurret |
| ch_scuttle_crab_kills | scuttleCrabKills |
| ch_skillshots_dodged | skillshotsDodged |
| ch_multi_kill_one_spell | multiKillOneSpell |
| ch_save_ally_from_death | saveAllyFromDeath |
| ch_takedowns_in_alcove | takedownsInAlcove |
| ch_turret_plates_taken | turretPlatesTaken |
| ch_heal_from_map_sources | HealFromMapSources |
| ch_12_assist_streak_count | 12AssistStreakCount |
| ch_infernal_scale_pickup | InfernalScalePickup |
| ch_aces_before_15_minutes | acesBefore15Minutes |
| ch_deaths_by_enemy_champs | deathsByEnemyChamps |
| ch_kills_under_own_turret | killsUnderOwnTurret |
| ch_rift_herald_takedowns | riftHeraldTakedowns |
| ch_team_rift_herald_kills | teamRiftHeraldKills |
| ch_kills_near_enemy_turret | killsNearEnemyTurret |
| ch_team_elder_dragon_kills | teamElderDragonKills |
| ch_elder_dragon_multikills | elderDragonMultikills |
| ch_first_turret_killed_time | firstTurretKilledTime |
| ch_fist_bump_participation | fistBumpParticipation |
| ch_mejais_full_stack_in_time | mejaisFullStackInTime |
| ch_takedown_on_first_turret | takedownOnFirstTurret |
| ch_takedowns_first_x_minutes | takedownsFirstXMinutes |
| ch_ward_takedowns_before_20_m | wardTakedownsBefore20M |
| ch_jungle_cs_before_10_minutes | jungleCsBefore10Minutes |
| ch_kill_after_hidden_with_ally | killAfterHiddenWithAlly |
| ch_land_skill_shots_early_game | landSkillShotsEarlyGame |
| ch_perfect_dragon_souls_taken | perfectDragonSoulsTaken |
| ch_took_large_damage_survived | tookLargeDamageSurvived |
| ch_two_wards_one_sweeper_count | twoWardsOneSweeperCount |
| ch_max_level_lead_lane_opponent | maxLevelLeadLaneOpponent |
| ch_takedowns_in_enemy_fountain | takedownsInEnemyFountain |
| ch_immobilize_and_kill_with_ally | immobilizeAndKillWithAlly |
| ch_knock_enemy_into_team_and_kill | knockEnemyIntoTeamAndKill |
| ch_lane_minions_first_10_minutes | laneMinionsFirst10Minutes |
| ch_played_champ_select_position | playedChampSelectPosition |
| ch_complete_support_quest_in_time | completeSupportQuestInTime |
| ch_dodge_skill_shots_small_window | dodgeSkillShotsSmallWindow |
| ch_multi_turret_rift_herald_count | multiTurretRiftHeraldCount |
| ch_survived_single_digit_hp_count | survivedSingleDigitHpCount |
| ch_turrets_taken_with_rift_herald | turretsTakenWithRiftHerald |
| ch_laning_phase_gold_exp_advantage | laningPhaseGoldExpAdvantage |
| ch_more_enemy_jungle_than_opponent | moreEnemyJungleThanOpponent |
| ch_enemy_champion_immobilizations | enemyChampionImmobilizations |
| ch_kills_with_help_from_epic_monster | killsWithHelpFromEpicMonster |
| ch_max_cs_advantage_on_lane_opponent | maxCsAdvantageOnLaneOpponent |
| ch_twenty_minions_in_3_seconds_count | twentyMinionsIn3SecondsCount |
| ch_epic_monster_stolen_without_smite | epicMonsterStolenWithoutSmite |
| ch_blast_cone_opposite_opponent_count | blastConeOppositeOpponentCount |
| ch_multikills_after_aggressive_flash | multikillsAfterAggressiveFlash |
| ch_survived_three_immobilizes_in_fight | survivedThreeImmobilizesInFight |
| ch_early_laning_phase_gold_exp_advantage | earlyLaningPhaseGoldExpAdvantage |
| ch_elder_dragon_kills_with_opposing_soul | elderDragonKillsWithOpposingSoul |
| ch_epic_monster_kills_near_enemy_jungler | epicMonsterKillsNearEnemyJungler |
| ch_takedowns_before_jungle_minion_spawn | takedownsBeforeJungleMinionSpawn |
| ch_vision_score_advantage_lane_opponent | visionScoreAdvantageLaneOpponent |
| ch_outer_turret_executes_before_10_minutes | outerTurretExecutesBefore10Minutes |
| ch_baron_buff_gold_advantage_over_threshold | baronBuffGoldAdvantageOverThreshold |
| ch_kills_on_other_lanes_early_jungle_as_laner | killsOnOtherLanesEarlyJungleAsLaner |
| ch_takedowns_after_gaining_level_advantage | takedownsAfterGainingLevelAdvantage |
| ch_killed_champ_took_full_team_damage_survived | killedChampTookFullTeamDamageSurvived |
| ch_epic_monster_kills_within_30_seconds_of_spawn | epicMonsterKillsWithin30SecondsOfSpawn |
| ch_jungler_takedowns_near_damaged_epic_monster | junglerTakedownsNearDamagedEpicMonster |
| ch_get_takedowns_in_all_lanes_early_jungle_as_laner | getTakedownsInAllLanesEarlyJungleAsLaner |
| ch_control_ward_time_coverage_in_river_or_enemy_half | controlWardTimeCoverageInRiverOrEnemyHalf |

---

### `participant_items`

| Colonne | Source Riot |
|--------|-------------|
| participant_id, match_id | — |
| item_id | participants[].items[slot] (slot 0–6) |
| item_slot | 0–5 (build), 6 (trinket) |
| starter | false à l’ingestion match ; true si premier ITEM_PURCHASED non-ward (timeline) |

---

### `participant_runes`

| Colonne | Source Riot |
|--------|-------------|
| participant_id, match_id | — |
| perk_id | perks.styles[].selections[].perk |
| slot | Index dans selections |
| style_id | perks.styles[].id |
| var_1, var_2, var_3 | perks.styles[].selections[].var1, var2, var3 |

---

### `participant_summoner_spells`

| Colonne | Source Riot |
|--------|-------------|
| participant_id, match_id | — |
| spell_id | summoner1Id / summoner2Id |
| spell_slot | 1 ou 2 |
| casts | summoner1Casts / summoner2Casts |

---

### `participant_spells`

| Colonne | Source Riot |
|--------|-------------|
| participant_id, match_id | — |
| spell_slot | 1=Q, 2=W, 3=E, 4=R |
| casts | spell1Casts … spell4Casts |

---

### `participant_perks`

| Colonne | Source Riot |
|--------|-------------|
| participant_id, match_id | — |
| perk_id | statPerks.defense, statPerks.flex, statPerks.offense |

---

### `participant_jungle_first_clear` (timeline)

| Colonne | Source Riot |
|--------|-------------|
| participant_id, match_id | — |
| order_index | Ordre du camp tué (0, 1, 2, …) d’après jungleMinionsKilled par frame |
| timestamp_ms | frame.timestamp |

---

### `match_teams_drake` (timeline)

| Colonne | Source Riot |
|--------|-------------|
| match_id, match_team_id | — |
| drake_type | ELITE_MONSTER_KILL.monsterSubType (ex. FIRE_DRAGON, ELDER_DRAGON) |
| soul | null ; rempli par DRAGON_SOUL_GIVEN.name pour la dernière ligne de l’équipe |
| order | Ordre global du kill (1 = premier drake du match) |

---

### `participant_spell_orders` (timeline)

| Colonne | Source Riot |
|--------|-------------|
| participant_id, match_id | — |
| spell_slot | SKILL_LEVEL_UP.skillSlot (1=Q … 4=R) |
| order | Index 1-based du level-up pour ce participant |
| timestamp_ms | SKILL_LEVEL_UP.timestamp |

---

### `challenge_keys_registry`

| Colonne | Source Riot |
|--------|-------------|
| key | Clé présente dans participants[].challenges mais hors allowlist |
| sample_value | Valeur brute (JSON) pour notification Discord |
| is_new | true à la création ; false après notification |
| notified_at | Rempli après envoi Discord |
| poll_value | false par défaut (indique si la clé est candidate à l'allowlist) |
