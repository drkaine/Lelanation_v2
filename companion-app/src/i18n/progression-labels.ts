/** Forever Talone « The Improvement » checklist — FR source + EN adaptation */

export const checklistSectionLabels = {
  fr: {
    base: "Base",
    farm: "Farm",
    farm_training: "Entraînement au farm",
    farm_tower: "Farm sous tourelle",
    wave: "Gestion des vagues / Wave Management",
    lane: "Phase de lane",
    warding: "Warding / Contrôle de la carte",
    map_awareness: "Conscience de la carte / Map Awareness",
  },
  en: {
    base: "Base",
    farm: "Farm",
    farm_training: "CS practice",
    farm_tower: "Farming under tower",
    wave: "Wave management",
    lane: "Lane phase",
    warding: "Warding / Map control",
    map_awareness: "Map awareness",
  },
} as const;

export const sectionIntroFr: Record<string, string> = {
  farm: "Je sais farmer un maximum de CS en fonction de l'opposition que je rencontre :",
  farm_training: "Je sais m'entraîner à farmer :",
  farm_tower: "Je sais farmer sous tourelle",
  wave: "",
  lane: "",
  warding:
    "Je peux ward et contrôler la carte efficacement, ainsi que priver l'équipe ennemie de vision.",
  map_awareness:
    "Je suis conscient de ce qui se passe sur toute la carte et je peux évaluer et utiliser ces informations à mon avantage.",
};

export const sectionIntroEn: Record<string, string> = {
  farm: "I can farm as much CS as possible depending on my matchup:",
  farm_training: "I know how to practice farming:",
  farm_tower: "I can farm under tower",
  wave: "",
  lane: "",
  warding: "I ward and control the map effectively, denying enemy vision.",
  map_awareness:
    "I am aware of what happens across the map and use that information to my advantage.",
};

export const checklistItemLabelsFr: Record<string, string> = {
  base_stable_internet:
    "Ma connexion Internet est stable et je pourrai jouer à League of Legends sans problème",
  base_no_distractions:
    "Je joue sans distraction, stream ou autres pendant l'heure à venir.",
  farm_cs_vs_bot_95: "Au moins 95 % des CS contre un bot",
  farm_cs_vs_weaker_90: "Au moins 90 % des CS contre un adversaire humain plus faible",
  farm_cs_vs_equal_80: "Au moins 80 % des CS contre un adversaire humain de mon niveau",
  farm_practice_l1:
    "Niveau 1 : avec les items et les runes de mon choix, sans adversaire",
  farm_practice_l2: "Niveau 2 : tout en me déplaçant, en ne faisant que des last hits",
  farm_practice_l3:
    "Niveau 3 : en faisant tout ce qui précède, en alternant entre push et geler la voie",
  farm_practice_l4: "Niveau 4 : en faisant tout ce qui précède, avec un bot dans ma voie",
  farm_practice_l5:
    "Niveau 5 : en faisant tout ce qui précède, sans aide de mes runes, sans item",
  farm_practice_l6:
    "Niveau 6 : en faisant tout ce qui précède, en vérifiant la minimap toutes les 5 secondes ou entre chaque dernier coup",
  farm_practice_l7:
    "Niveau 7 : en faisant tout ce qui précède, en essayant de faire en sorte que les morts des sbires alternent des deux côtés (un seul sbire mourant à tout moment)",
  farm_under_tower_min_loss:
    "Je suis capable de farmer sous ma tourelle en perdant le moins de sbires possible et je maîtrise pleinement la technique pour le faire",
  farm_under_tower_while_pushed:
    "Je suis capable de farmer sous ma tourelle tout en étant activement poussé par mon adversaire de la voie",
  farm_under_tower_skills_aa:
    "Je suis capable d'utiliser à la fois des compétences de waveclear et des attaques automatiques pour farmer efficacement sous ma tourelle",
  wave_control_push_harass:
    "Je peux contrôler correctement mes vagues de sbires et surveiller les vagues de sbires ennemies afin de push et harceler correctement",
  wave_even_odd_rules: "Je comprends les règles des vagues de sbires égales et inégales",
  wave_freeze_three_methods:
    "Je suis capable de freeze ma lane en utilisant les trois méthodes de freeze",
  wave_reset_break_freeze: "Je comprends comment reset ma lane et briser un freeze",
  wave_slow_fast_push:
    "Je suis capable de push une voie et je sais comment à la fois slow push et fast push",
  wave_push_for_objectives:
    "Je comprends quand il faut push les voies pour mettre la pression sur d'autres objectifs de la carte",
  wave_first4_range_vs_melee: "Je suis range contre un mêlée",
  wave_first4_melee_vs_range: "Je suis mêlée contre un range",
  wave_first4_melee_vs_melee: "Je suis mêlée contre un mêlée",
  wave_first4_range_vs_range: "Je suis range contre un range",
  wave_first4_solo_lane: "Je suis seul sur ma voie",
  lane_play_and_punish:
    "Je suis capable de bien jouer la phase de lane et de punir mon adversaire",
  lane_farm_timing: "Je comprends comment et quand farmer pendant la phase de lane",
  lane_trade_harass: "Je peux harceler et trade avec mon adversaire",
  lane_punish_positioning:
    "Je peux punir mon adversaire pour ses erreurs de positionnement et exploiter les timers de ses CD",
  lane_harass_on_cs: "Je peux harceler mon adversaire pendant qu'il obtient des CS",
  lane_punish_when_ahead:
    "Je peux punir mon adversaire en utilisant n'importe quelle méthode lorsque je gagne ma lane",
  lane_all_in_timing: "Je sais comment et quand all-in mon adversaire",
  lane_roam_timing: "Je comprends comment et quand roam",
  lane_snowball_lead:
    "Je peux correctement créer une avance et snowball à partir de ma phase de lane",
  lane_lose_lane_adjust:
    "Je comprends comment « perdre » la voie ; je peux ajuster mon style de jeu quand je ne gagne pas",
  lane_follow_jungler_ganks: "Je peux suivre les ganks de mon jungler à chaque fois",
  lane_end_lane_phase: "Je comprends comment terminer la phase de lane",
  lane_ping_missing: "Je ping chaque fois que mon adversaire n'est pas dans sa voie",
  lane_ping_missing_important:
    "Si je sais où va / est mon adversaire : je ping plusieurs fois si c'est important pour mes mates",
  lane_ping_no_vision:
    "Je ping chaque fois que mon équipe n'a pas de vision sur mon adversaire",
  lane_back_timing: "Je sais quand back",
  lane_avoid_overstay: "Je sais éviter d'overstay",
  lane_no_overextend:
    "À moins d'être absolument en sécurité et de savoir où se trouve le jungler ennemi, je ne ferai pas d'overextend",
  lane_first4_range_vs_melee: "Je suis range contre un mêlée (4 premières waves)",
  lane_first4_melee_vs_range: "Je suis mêlée contre un range (4 premières waves)",
  lane_first4_melee_vs_melee: "Je suis mêlée contre un mêlée (4 premières waves)",
  lane_first4_range_vs_range: "Je suis range contre un range (4 premières waves)",
  lane_first4_solo_lane: "Je suis seul sur ma voie (4 premières waves)",
  warding_lane_phase: "Je ward pendant la phase de lane",
  warding_all_game: "Je ward tout au long de la partie",
  pink_wards: "J'achète au moins une pink ward à chaque partie",
  ward_efficient_spots: "Je sais où warder pour obtenir efficacement de la vision",
  ward_maximize_each: "Je peux maximiser l'efficacité de chaque ward que je place",
  ward_before_push: "Je ward toujours avant de push ma lane",
  ward_deduce_enemy:
    "Je peux utiliser les informations de mes wards pour déduire où se trouve l'équipe ennemie et où elle se dirige, en particulier le jungler",
  ward_ping_important_info:
    "Je ping si je vois une information importante sur l'emplacement de l'équipe ennemie sur la carte",
  ward_manipulate_enemy:
    "Je peux manipuler les actions de l'équipe ennemie via mon map control",
  ward_deny_vision: "Je deny (priver) un maximum de vision à l'équipe ennemie",
  trinket_red_timing: "Je comprends quand acheter un trinket rouge",
  trinket_blue_timing: "Je comprends quand acheter un trinket bleu",
  avoid_facecheck: "Je comprends comment éviter de facecheck les buissons",
  facecheck_when_necessary: "Je sais facecheck les buissons quand je n'ai pas le choix",
  map_check_lane: "Je vérifie régulièrement la minimap pendant la phase de lane",
  map_check_post_lane: "Je vérifie régulièrement la minimap après la phase de lane",
  map_check_all_game: "Je vérifie régulièrement la minimap tout au long de la partie",
  map_check_every_5_10s: "Je vérifie la carte toutes les 5 à 10 secondes",
  map_ping_important: "Je ping si je vois une information importante sur la minimap",
  map_ping_for_team:
    "Je ping s'il y a quelque chose d'important qui se passe autour de la carte pour informer mes coéquipiers",
  map_ping_enemy_jungler_lane:
    "Si je vois le jungler ennemi pendant la phase de lane, je le ping",
  map_ping_objective_suspect:
    "Si j'ai des raisons probables de croire que l'ennemi prend le baron/dragon/rift herald, je ping (même si je ne suis pas sûr)",
  map_communicate_jungler_pos:
    "Si je sais où se trouve le jungler ennemi, j'informerai mon équipe (ex. « sej bot side »)",
  map_communicate_roam_direction:
    "Si je sais où se dirige quelqu'un qui roam, ou où se dirige le jungler ennemi, j'informerai mon équipe (ex. « lb inc top »)",
  map_ping_multiple_if_important:
    "Je ping plusieurs fois si l'information que je transmets est particulièrement importante",
  map_no_ping_spam:
    "Je ne spamme pas les pings de manière excessive lorsque ce n'est pas nécessaire, afin que mes coéquipiers respectent les informations que je transmets par ping",
};

export const checklistItemLabelsEn: Record<string, string> = {
  base_stable_internet:
    "My internet connection is stable and I can play League of Legends without issues",
  base_no_distractions:
    "I play without distractions, streams or other interruptions for the next hour",
  farm_cs_vs_bot_95: "At least 95% CS vs a bot",
  farm_cs_vs_weaker_90: "At least 90% CS vs a weaker human opponent",
  farm_cs_vs_equal_80: "At least 80% CS vs an evenly matched human opponent",
  farm_practice_l1: "Level 1: chosen items and runes, no opponent",
  farm_practice_l2: "Level 2: while moving, last hits only",
  farm_practice_l3: "Level 3: + alternate push and freeze the wave",
  farm_practice_l4: "Level 4: + bot in my lane",
  farm_practice_l5: "Level 5: + no runes and no items",
  farm_practice_l6: "Level 6: + check minimap every 5 seconds or between last hits",
  farm_practice_l7:
    "Level 7: + alternate minion deaths on both sides (only one minion dying at a time)",
  farm_under_tower_min_loss:
    "I farm under tower losing as few minions as possible with full technique mastery",
  farm_under_tower_while_pushed: "I farm under tower while being actively pushed",
  farm_under_tower_skills_aa:
    "I use both waveclear abilities and auto-attacks to farm efficiently under tower",
  wave_control_push_harass:
    "I control my waves and track enemy waves to push and harass correctly",
  wave_even_odd_rules: "I understand even and odd minion wave rules",
  wave_freeze_three_methods: "I can freeze my lane using three freeze methods",
  wave_reset_break_freeze: "I understand how to reset lane and break a freeze",
  wave_slow_fast_push: "I can push a lane with both slow and fast push",
  wave_push_for_objectives: "I know when to push lanes for map objective pressure",
  wave_first4_range_vs_melee: "Ranged vs melee matchup (first 4 waves)",
  wave_first4_melee_vs_range: "Melee vs ranged matchup (first 4 waves)",
  wave_first4_melee_vs_melee: "Melee vs melee matchup (first 4 waves)",
  wave_first4_range_vs_range: "Ranged vs ranged matchup (first 4 waves)",
  wave_first4_solo_lane: "Solo lane (first 4 waves)",
  lane_play_and_punish: "I play lane well and punish my opponent",
  lane_farm_timing: "I understand how and when to farm during lane phase",
  lane_trade_harass: "I can harass and trade with my opponent",
  lane_punish_positioning: "I punish positioning mistakes and cooldown timers",
  lane_harass_on_cs: "I harass when my opponent takes CS",
  lane_punish_when_ahead: "I punish using any method when ahead in lane",
  lane_all_in_timing: "I know how and when to all-in my opponent",
  lane_roam_timing: "I understand how and when to roam",
  lane_snowball_lead: "I snowball a lead from lane phase",
  lane_lose_lane_adjust: "I adjust my playstyle when I am not winning lane",
  lane_follow_jungler_ganks: "I follow my jungler's ganks every time",
  lane_end_lane_phase: "I understand how to end the laning phase",
  lane_ping_missing: "I ping every time my opponent leaves lane",
  lane_ping_missing_important:
    "When I know where my opponent is going: I ping multiple times if critical for teammates",
  lane_ping_no_vision: "I ping when my team lacks vision on my opponent",
  lane_back_timing: "I know when to recall",
  lane_avoid_overstay: "I avoid overstaying",
  lane_no_overextend:
    "Unless completely safe with enemy jungler tracked, I do not overextend",
  lane_first4_range_vs_melee: "Ranged vs melee (first 4 waves)",
  lane_first4_melee_vs_range: "Melee vs ranged (first 4 waves)",
  lane_first4_melee_vs_melee: "Melee vs melee (first 4 waves)",
  lane_first4_range_vs_range: "Ranged vs ranged (first 4 waves)",
  lane_first4_solo_lane: "Solo lane (first 4 waves)",
  warding_lane_phase: "I ward during lane phase",
  warding_all_game: "I ward throughout the game",
  pink_wards: "I buy at least one control ward every game",
  ward_efficient_spots: "I know where to ward for efficient vision",
  ward_maximize_each: "I maximize the value of each ward I place",
  ward_before_push: "I always ward before pushing my lane",
  ward_deduce_enemy:
    "I use ward info to deduce enemy positions and paths, especially the jungler",
  ward_ping_important_info: "I ping important enemy location info from vision",
  ward_manipulate_enemy: "I manipulate enemy actions through map control",
  ward_deny_vision: "I deny as much enemy vision as possible",
  trinket_red_timing: "I know when to buy red trinket",
  trinket_blue_timing: "I know when to buy blue trinket",
  avoid_facecheck: "I know how to avoid face-checking bushes",
  facecheck_when_necessary: "I face-check bushes when I have no choice",
  map_check_lane: "I check the minimap regularly during lane phase",
  map_check_post_lane: "I check the minimap regularly after lane phase",
  map_check_all_game: "I check the minimap regularly all game",
  map_check_every_5_10s: "I check the map every 5 to 10 seconds",
  map_ping_important: "I ping important minimap information",
  map_ping_for_team: "I ping important map events for my teammates",
  map_ping_enemy_jungler_lane: "I ping enemy jungler seen during lane phase",
  map_ping_objective_suspect:
    "I ping baron/dragon/herald even when I am not fully sure",
  map_communicate_jungler_pos: "I call enemy jungler position (e.g. sej bot side)",
  map_communicate_roam_direction: "I call roams and rotations (e.g. lb inc top)",
  map_ping_multiple_if_important: "I ping multiple times when information is critical",
  map_no_ping_spam:
    "I do not spam pings unnecessarily so teammates respect my calls",
};

export function progressionItemLabel(lang: string, id: string): string | undefined {
  const l = lang === "en" ? checklistItemLabelsEn : checklistItemLabelsFr;
  return l[id];
}

export function progressionSectionLabel(lang: string, section: string): string {
  const l = lang === "en" ? "en" : "fr";
  const labels = checklistSectionLabels[l];
  return labels[section as keyof typeof labels] ?? section;
}

export function progressionSectionIntro(lang: string, section: string): string {
  const intros = lang === "en" ? sectionIntroEn : sectionIntroFr;
  return intros[section] ?? "";
}
