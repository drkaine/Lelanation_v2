# EPIC — Page Theorycraft (données précises, dégâts réels, stacks)

**Version :** 1.0  
**Contexte :** Lelanation v2 — extension de l’Epic 5 Theorycraft & Analysis. Page dédiée pour optimiser son build avec les données les plus précises possibles.

---

## 1. Objectif global

Offrir une **page Theorycraft** où l’utilisateur :

- Sélectionne **champion**, **runes**, **items**, **niveau**, **stacks d’items** (ex. Cœur d’acier), **stacks de passifs** (Veigar, Smolder, Nasus, etc.).
- Voit **toutes les stats** apportées par le build, avec des valeurs **les plus précises possibles**.
- Peut **choisir le niveau** (1–18) et le **nombre de stacks** pour chaque élément stackable.
- Calcule les **dégâts réels sur un ennemi** (en prenant HP, armure et résistance magique en compte).
- Voit les **dégâts par niveau des sorts** (Q, W, E, R) avec les **bonnes valeurs des objets** (AD, AP, bonus) pour optimiser **build et ordre de montée**.

**Valeur livrée :** Une seule page pour avoir toutes les infos nécessaires pour optimiser son build et sa montée de compétences (dégâts par niveau, dégâts réels vs cible, impact des stacks).

**Intégration avec les builds existants :**

- **Sauvegarder le build** : le build configuré dans l’outil Theorycraft peut être **sauvegardé** comme un build classique (même flux que création / édition : localStorage, nom, auteur, etc.).
- **Utiliser un build déjà fait** : sur la page de détail d’un build (`/builds/[id]`), un bouton **« Tester le build »** charge ce build dans la page Theorycraft (navigation vers `/theorycraft` avec le build pré-rempli).

---

## 2. Périmètre fonctionnel

### 2.1 Sélections utilisateur

| Élément | Description | Précision |
|--------|-------------|-----------|
| **Champion** | Choix du champion (comme création de build). | Données Data Dragon / championFull. |
| **Niveau** | Niveau du personnage (1–18). | Déjà supporté dans `statsCalculator` ; à exposer dans l’UI. |
| **Runes** | Arbre principal, secondaire, shards. | Données runesReforged ; calcul runes à compléter (bonus réels). |
| **Items** | Jusqu’à 6 objets. | Données Data Dragon ; **stacks** à gérer (voir 2.2). |
| **Ordre de montée** | Ordre Q/W/E/R par niveau 1–18. | Déjà en place (SkillOrderSelector) ; utilisé pour afficher dégâts par niveau. |
| **Stacks d’items** | Nombre de stacks pour chaque objet stackable. | Ex. Cœur d’acier (Heart of Steel) : 0–N stacks ; catalogue à définir. |
| **Stacks de passifs** | Valeur des passifs stackables par champion. | Veigar (AP), Smolder (Q stacks), Nasus (Q), Sion (HP), etc. ; catalogue par champion. |

### 2.2 Sauvegarde et chargement du build

- **Sauvegarder le build** : le build configuré dans l’outil Theorycraft (champion, runes, items, ordre de montée, niveau, stacks) peut être **sauvegardé** comme un build classique :
  - Même flux que la création / édition de build (BuildStore, localStorage, nom, auteur, version de jeu).
  - Bouton « Sauvegarder le build » sur la page Theorycraft ; si le build provient d’un build existant (chargé via « Tester le build »), option « Enregistrer les modifications » ou « Sauvegarder sous un nouveau nom ».
- **Utiliser un build déjà fait** : sur la page de détail d’un build (`/builds/[id]` ou équivalent), un bouton **« Tester le build »** :
  - Charge le build dans le BuildStore (ou état Theorycraft dédié).
  - Redirige vers la page **Theorycraft** (`/theorycraft`) avec le build pré-rempli (champion, items, runes, ordre de montée).
  - L’utilisateur peut alors ajuster niveau, stacks, cible adverse, combo, puis sauvegarder éventuellement sous le même ID ou un nouveau build.

### 2.3 Items stackables (exemples)

- **Cœur d’acier (Heart of Steel)** : stacks donnant bonus d’armure / vie (selon description officielle).
- Autres objets à stack : **Mejai**, **Muramana**, **Manamune**, **Void Staff** (stacks légendaires), etc.
- Pour chaque objet stackable : **champ numérique** (0 à max) ou slider pour le nombre de stacks.
- Les **stats finales** (armure, AD, AP, etc.) doivent intégrer ces stacks (formules depuis Data Dragon / wiki / Community Dragon si besoin).

### 2.4 Passifs stackables par champion (exemples)

| Champion | Passif / mécanique | Paramètre utilisateur |
|----------|--------------------|------------------------|
| **Veigar** | AP bonus par stack (Q farm). | Nombre de stacks (ex. 0–2000). |
| **Smolder** | Stacks Q (dégâts, zone, etc.). | Nombre de stacks Q. |
| **Nasus** | Dégâts bonus Q par kill. | Nombre de stacks Q. |
| **Sion** | HP bonus par kill. | Nombre de stacks (HP). |
| **Kindred** | Marques (bonus portée, dégâts). | Nombre de marques. |
| **Thresh** | Armure / AP par âmes. | Nombre d’âmes. |
| **Bard** | Chimes (AP, mana, etc.). | Nombre de chimes. |
| **Senna** | Âmes (AD, crit, portée). | Nombre d’âmes. |

- Liste extensible : **catalogue champion → variable(s) stackable(s)** avec formule (ex. Veigar : `bonus_ap = f(stacks)`).
- Données : **Community Dragon** (formules précises) ou **Data Dragon + wiki** en fallback.

### 2.5 Cible ennemi (dégâts réels)

- **Paramètres cible** : HP, Armure, Résistance magique (saisie utilisateur ou profils prédéfinis : “ADC 18”, “Tank 18”, etc.).
- **Dégâts réels** :
  - **Physiques** : après **pénétration d’armure** (pourcentage + lethality) → `dégât_final = dégât_brut * facteur_armure`.
  - **Magiques** : après **pénétration de RM** → `dégât_final = dégât_brut * facteur_rm`.
  - **Vrais** : pas de réduction.
- Formules LoL (à implémenter) :
  - Armure : `facteur = 100 / (100 + armure_effective)` ; armure effective après % pen puis lethality (niveau).
  - RM : idem avec `magicResist`.

### 2.6 Build de l’adversaire (cible réaliste)

Pour être **au plus proche de la réalité**, la cible ennemi peut être définie comme un **build adverse complet** :

- **Champion adverse** : choix du champion (optionnel ; sinon on garde HP / Armure / RM manuels).
- **Niveau adverse** : niveau 1–18 (détermine les stats de base du champion adverse).
- **Build adverse** : items (jusqu’à 6), runes, **stacks d’items** et **stacks de passifs** du même type que pour le joueur.
- **Calcul** : à partir du champion adverse + niveau + items + runes + stacks, on calcule **HP, Armure, RM** (et éventuellement autres stats utiles) de l’ennemi, puis on applique les formules de dégâts réels (2.4).
- **UI** : section « Build de l’adversaire » avec les mêmes contrôles que pour le joueur (champion, niveau, items, runes, stacks), ou mode simplifié « Saisie manuelle » (HP / Armure / RM seuls). Bascule possible entre les deux modes.

### 2.7 Dégâts d’un combo (séquence + temps)

- **Définition du combo** : l’utilisateur construit une **séquence d’actions** (ex. : Auto + Q + reset auto + W + E).
- **Actions possibles** : Auto-attaque, Q, W, E, R (et éventuellement passif proc, item actif, etc.).
- **Résultat affiché** :
  - **Dégâts totaux** du combo (somme des dégâts réels de chaque action vs la cible / build adverse).
  - **Temps total** du combo : somme des délais (temps de cast, animation, reset d’auto après Q, etc.) pour refléter le temps réel d’exécution.
- **Objectif** : comparer différents combos (ex. Q + auto + W vs E + Q + auto) en dégâts et en temps pour optimiser l’enchaînement.
- **Données nécessaires** : temps de cast / animation par sort (Data Dragon ou Community Dragon) ; règles de reset d’auto (approximation ou données si dispo).

---

## 3. Données et précision

### 3.1 Sources de données

- **Data Dragon (championFull)** : stats de base, **spells** avec `effect`, `effectBurn`, `vars` (ratios AD/AP par rang).
- **Data Dragon (items)** : stats fixes + descriptions pour stacks (parsing ou champs dédiés si présents).
- **Community Dragon** : données plus précises (coefficients, formules de passifs, stacks) ; déjà utilisé côté backend pour certains assets.
- **Objectif** : utiliser **Community Dragon** pour les formules de sorts et passifs stackables quand disponible ; sinon Data Dragon + documentation officielle / wiki.

### 3.2 Sorts : dégâts par niveau (rank) et par niveau personnage

- Pour chaque sort (Q, W, E, R) :
  - **Dégât de base** par rang (1–5 ou 1–3 pour R) : tableau `effect` ou `effectBurn` (Data Dragon).
  - **Ratios** : `vars` avec `link` (ex. `attackdamage`, `bonusattackdamage`, `spelldamage`) et `coeff` (ex. [0.65] = 65% AD).
  - **Calcul** : à chaque rang du sort et niveau personnage choisi :
    - Stats du personnage au niveau N (avec items, runes, **stacks d’items**, **stacks passif**).
    - Dégât brut = base(rank) + ratio_AD * AD + ratio_AP * AP + éventuels bonus (passif, items).
  - **Dégât réel vs cible** : application de l’armure / RM (et pénétration) comme en 2.4.
- Affichage : **tableau ou liste** “Dégâts par niveau de sort” (rang 1–5) et “au niveau personnage 6 / 11 / 18” (ex.), avec dégât brut et dégât réel vs cible choisie.

### 3.3 Runes : bonus réels

- Actuellement `calculateRuneStats` est simplifié (retour partiel).
- Objectif : **calculer tous les bonus** des runes sélectionnées (AD, AP, HP, armure, RM, haste, etc.) à partir des données runesReforged (et Community Dragon si besoin).
- Intégration dans le **moteur de stats** utilisé par la page Theorycraft (même entrée que build : champion, niveau, items, runes, stacks).

---

## 4. Architecture technique

### 4.1 Réutilisation existant

- **BuildStore** / état build : champion, items, runes, shards, ordre de montée (réutilisables).
- **statsCalculator.ts** : `calculateStats(champion, items, runes, shards, level)` — à **étendre** pour :
  - **Stacks d’items** : paramètre optionnel `itemStacks: Record<itemId, number>` ; pour chaque objet stackable, appliquer le bonus selon le nombre de stacks.
  - **Stacks de passif** : paramètre optionnel `passiveStacks: Record<championId, number>` ou structure par champion (ex. Veigar: { q: 500 }, Nasus: { q: 300 }).
- **Composants Build** : ChampionSelector, ItemSelector, RuneSelector, SkillOrderSelector — réutilisables dans la page Theorycraft ; ajout des **contrôles niveau + stacks**.

### 4.2 Nouveaux éléments

- **Page** : `frontend/pages/theorycraft/index.vue` (ou `theorycraft.vue`).
- **Bouton « Tester le build »** : ajout dans le composant **BuildDetailsPage** (page `/builds/[id]`) ; au clic : charger le build dans le BuildStore (ou état Theorycraft), puis navigation vers `localePath('/theorycraft')` avec éventuellement un paramètre (ex. `?from=build&id=xxx`) pour pré-remplir et afficher une option « Sauvegarder les modifications » si l’utilisateur modifie le build.
- **Sauvegarde depuis Theorycraft** : réutilisation de `buildStore.saveBuild()` (même logique que page création / édition) ; le build courant (champion, items, runes, ordre de montée, nom, etc.) est sauvegardé en localStorage ; possibilité d’ouvrir un modal nom / auteur comme en création de build.
- **Moteur de dégâts** :
  - **Parsing des sorts** : interpréter `effect` / `vars` des spells (Data Dragon) pour extraire base + ratios par rang.
  - **Calcul dégât brut** par sort (par rang et niveau personnage) avec stats courantes (incluant stacks).
  - **Calcul dégât réel** : appliquer armure / RM + pénétration (formules LoL).
- **Catalogue stackable** :
  - **Items** : liste des itemIds stackables + formule par stack (ex. Cœur d’acier : X armure par stack, max N). Source : Data Dragon description ou JSON dédié (maintenu à la main ou généré depuis Community Dragon).
  - **Champions** : liste des championIds avec passif stackable + formule (ex. Veigar : AP = f(stacks)). Source : Community Dragon ou JSON dédié.
- **UI** :
  - Sélecteur de **niveau** (1–18).
  - Bloc **stacks d’items** : pour chaque objet stackable dans le build, input “Nombre de stacks”.
  - Bloc **stacks de passif** : si champion a un passif stackable, input “Stacks” (et sous-champs si plusieurs types, ex. Kindred marques).
  - Bloc **cible ennemi** : HP, Armure, RM (inputs + profils prédéfinis) **ou** section **Build de l’adversaire** (champion, niveau, items, runes, stacks) pour une cible au plus proche de la réalité.
  - **Tableau des stats** : toutes les stats du build (réutilisation StatsTable / StatsDisplay en mode “complet”).
  - **Section dégâts des sorts** : par Q/W/E/R, dégât brut et dégât réel vs cible, par rang de sort ; option “au niveau actuel” ou “à 6 / 11 / 18”.
  - **Section combo** : construction de la séquence (Auto, Q, W, E, R, reset auto) ; affichage dégâts totaux et temps total.
  - **Sauvegarder le build** : bouton “Sauvegarder le build” (flux identique à la création de build).
- **Page build (`/builds/[id]`)** : bouton **« Tester le build »** qui charge le build et redirige vers `/theorycraft`.

### 4.3 Formules de dégâts (rappel LoL)

- **Dégât physique** :  
  `dmg_phys_brut = base_phys + ratio_ad * AD + ratio_bonus_ad * bonus_AD`  
  Armure effective après pénétration % puis lethality :  
  `armor_eff = (1 - pen_pct) * armor - lethality * f(level)`  
  `dmg_phys_reel = dmg_phys_brut * 100 / (100 + armor_eff)`.
- **Dégât magique** :  
  `dmg_mag_brut = base_mag + ratio_ap * AP`  
  `dmg_mag_reel = dmg_mag_brut * 100 / (100 + mr_eff)` (mr_eff après pénétration %).
- **Dégât vrai** : pas de réduction.
- **Lethality** : formule officielle Riot (niveau du défenseur) ; à implémenter précisément.

---

## 5. Parcours utilisateur (résumé)

**Depuis la page Theorycraft :**

1. Aller sur **Theorycraft** (ou arriver avec un build pré-rempli via **« Tester le build »** depuis `/builds/[id]`).
2. Choisir **champion**, **runes**, **items**, **ordre de montée** (réutilisation build).
3. Régler **niveau** (1–18) et **stacks** (items + passifs si applicable).
4. Consulter le **récap des stats** (toutes les stats avec valeurs précises).
5. Configurer la **cible ennemi** : saisie manuelle (HP, armure, RM) ou **build de l’adversaire** (champion, niveau, items, runes, stacks) pour être au plus proche de la réalité.
6. Consulter les **dégâts par sort** (brut et réel vs cible) par rang et niveau.
7. Optionnel : définir un **combo** (ex. Auto + Q + reset auto + W + E) et voir **dégâts totaux** et **temps total** du combo.
8. **Sauvegarder le build** (comme un build classique) ou, si venu depuis « Tester le build », enregistrer les modifications ou sauvegarder sous un nouveau nom.

**Depuis la page d’un build (`/builds/[id]`) :**

1. Cliquer sur **« Tester le build »**.
2. Être redirigé vers **Theorycraft** avec le build chargé ; ajuster niveau, stacks, cible adverse, combo ; sauvegarder si besoin.

---

## 6. Livrables (MVP puis extensions)

### Phase 1 (MVP)

- Page **Theorycraft** avec sélection champion, runes, items, **niveau** (1–18).
- **Sauvegarder le build** : bouton « Sauvegarder le build » (même flux que création de build : BuildStore, localStorage).
- **Tester le build** : bouton « Tester le build » sur la page détail d’un build (`/builds/[id]`) ; chargement du build puis redirection vers `/theorycraft` avec le build pré-rempli.
- Réutilisation complète du **calcul de stats** existant (étendu niveau uniquement si pas déjà exposé).
- **Affichage de toutes les stats** (tableau détaillé) avec valeurs précises.
- **Dégâts des sorts** : dégâts **bruts** par Q/W/E/R par rang (1–5 ou 1–3), en utilisant les stats du build au niveau choisi (sans stacks au début si complexité).
- **Ordre de montée** affiché / éditable et utilisé pour indiquer “prochain niveau : Q/W/E/R”.

### Phase 2

- **Stacks d’items** : catalogue (Cœur d’acier, Mejai, Manamune, etc.) + champs “stacks” dans l’UI + intégration dans le calcul de stats.
- **Stacks de passifs** : catalogue (Veigar, Nasus, Smolder, Sion, etc.) + champs “stacks” + intégration dans stats et dégâts des sorts.
- **Cible ennemi** : champs HP, Armure, RM + calcul des **dégâts réels** (physiques, magiques, vrais) avec pénétration.
- **Build de l’adversaire** : section « Build de l’adversaire » avec champion, niveau, items, runes, stacks ; calcul automatique HP / Armure / RM de la cible pour dégâts réels au plus proche de la réalité.
- Affichage **dégât brut vs dégât réel** par sort.
- **Combo** : construction d’une séquence d’actions (Auto, Q, W, E, R, reset auto) ; affichage **dégâts totaux** et **temps total** du combo vs la cible.

### Phase 3

- **Profils cible** prédéfinis (ADC 18, Tank 18, Mage 18…).
- **Runes** : calcul complet des bonus (tous runes, pas seulement shards).
- **Community Dragon** : utilisation pour formules de sorts et passifs quand disponible (précision maximale).
- Export / partage de la config Theorycraft (lien ou copier-coller).

---

## 7. Indicateurs de succès

- L’utilisateur peut **voir toutes les stats** de son build à tout niveau (1–18) avec des valeurs cohérentes avec le jeu.
- L’utilisateur peut **régler les stacks** (items + passifs) et voir l’impact sur les stats et les dégâts.
- Les **dégâts affichés par sort** (brut et réel) sont **cohérents** avec les formules officielles (vérification manuelle sur quelques champions).
- La page permet d’**optimiser l’ordre de montée** en comparant les dégâts par rang et niveau.

---

## 8. Dépendances et risques

- **Données** : Data Dragon `effect` / `vars` peuvent varier selon les patches ; parser de façon robuste (fallback si format inconnu).
- **Community Dragon** : disponibilité et format des fichiers ; prévoir fallback Data Dragon + formules manuelles pour champions prioritaires.
- **Maintenance** : catalogue des items/champions stackables à tenir à jour à chaque patch (idéalement automatisé ou scripté).

---

## 9. Résumé exécutif

Cette EPIC décrit une **page Theorycraft** avec :

- **Sélection** : champion, runes, items, niveau (1–18), **stacks d’items** (ex. Cœur d’acier), **stacks de passifs** (Veigar, Smolder, Nasus, etc.).
- **Sauvegarde** : le build configuré dans l’outil peut être **sauvegardé** comme un build classique (même flux que création / édition).
- **Tester le build** : sur la page d’un build (`/builds/[id]`), bouton **« Tester le build »** qui charge le build et redirige vers Theorycraft pour l’analyser (niveau, stacks, cible, combo) et éventuellement sauvegarder.
- **Build de l’adversaire** : gestion du **niveau et des stacks** de la cible (champion adverse + items + runes + stacks) pour calculer HP / Armure / RM au plus proche de la réalité.
- **Stats** : affichage de **toutes les stats** avec les données les plus précises possibles (Data Dragon + Community Dragon).
- **Dégâts réels** : calcul des dégâts **vs un ennemi** (saisie manuelle ou build adverse) avec pénétration.
- **Dégâts par niveau des sorts** : dégâts bruts et réels par rang de sort, avec les bonnes valeurs des objets, pour **optimiser build et ordre de montée**.
- **Combo** : définition d’une **séquence d’actions** (ex. Auto + Q + reset auto + W + E) avec **dégâts totaux** et **temps total** du combo.

L’implémentation s’appuie sur l’existant (BuildStore, statsCalculator, composants Build) et ajoute un **moteur de dégâts**, des **catalogues stackables**, la **gestion du build adverse**, le **calcul de combo** (dégâts + temps) et une **UI dédiée** (niveau, stacks, cible / build adverse, combo, sauvegarde, bouton « Tester le build »).

---

*Document prêt pour découpage en user stories (page Theorycraft, sauvegarde, Tester le build, build adverse, combo, moteur de dégâts, catalogues stacks, intégration Community Dragon).*
