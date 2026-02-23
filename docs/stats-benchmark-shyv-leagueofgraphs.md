# Benchmark Stats - shyv & LeagueOfGraphs

## Objectif

Compiler ce que montrent les deux références produit suivantes pour guider l'évolution de la page stats:

- [shyv - Stats](https://shyv.net/stats)
- [LeagueOfGraphs - Tier List](https://www.leagueofgraphs.com/fr/champions/tier-list)
- [LeagueOfGraphs - Heimerdinger](https://www.leagueofgraphs.com/fr/champions/tier-list/heimerdinger)
- [LeagueOfGraphs - Blue vs Red](https://www.leagueofgraphs.com/fr/stats/blue-vs-red)

## 1) shyv - ce que la page exprime

### Positionnement visible

- Navigation simple et orientee usage: `Stats`, `Items`, `Build`, `My Builds`.
- Focus patch explicite (ex: `16.4`).
- Produit centre sur la decision rapide: choisir un champion, lire les stats, passer au build.

### Lecture produit

- UX compacte: peu de bruit, chemin court vers l'action.
- Couplage fort "stats -> build".
- Bon point d'inspiration: garder une page stats lisible et rapide, puis brancher vers les vues detail.

## 2) LeagueOfGraphs - ce que le produit couvre

## 2.1 Tier list globale

Source: [Tier List](https://www.leagueofgraphs.com/fr/champions/tier-list)

### Ce qui est mis en avant

- Cadre analytique complet: patch, volume de matchs, fenetre temporelle.
- Filtres multi-axes:
  - rang (Iron+ a Master+),
  - role,
  - region,
  - type de queue/mode.
- Navigation transverse vers modules lies:
  - counters, runes, skills, items, summoners, jungle paths, etc.

### Valeur produit

- Donne une vue meta globale.
- Facilite la comparaison inter-champions a grande echelle.
- Transforme un "tableau de stats" en vrai cockpit analytique.

## 2.2 Fiche champion (Heimerdinger)

Source: [Heimerdinger](https://www.leagueofgraphs.com/fr/champions/tier-list/heimerdinger)

### Blocs visibles

- KPI haut de page: popularite, winrate, banrate.
- Guidance gameplay:
  - ordre des skills,
  - starters,
  - core items,
  - bottes,
  - fin de build.
- Matchups: meilleurs/pires adversaires.
- Sorts d'invocateur, runes, role principal.
- Pro builds, meilleurs joueurs, replays.

### Valeur produit

- Page "actionnable": pas seulement de la data, mais des recommandations prêtes a jouer.
- Boucle complete: observer -> comprendre -> appliquer.

## 2.3 Blue vs Red (macro systemique)

Source: [Blue vs Red](https://www.leagueofgraphs.com/fr/stats/blue-vs-red)

### Ce qui est mesure

- Winrate cote bleu vs rouge selon file/mode.
- Objectifs par side:
  - dragons,
  - void grubs,
  - heralds,
  - barons.
- Champions les plus sensibles au side (delta de winrate).

### Valeur produit

- Vue "equilibre du jeu" (macro), complementaire des pages champion.
- Identifie biais structurels (map side advantage, profils champions sensibles).

## 3) Synthese comparee (shyv vs LeagueOfGraphs)

- `shyv`: plus minimaliste, direct, orienté usage rapide build/stats.
- `LeagueOfGraphs`: couverture fonctionnelle tres large, profondeur analytique forte.
- Les deux convergent sur:
  - filtrage par patch/rang/role,
  - articulation stats globales + pages champion,
  - mise en avant de "what to play" et "how to play".

## 4) Traduction concrete pour Lelanation

## 4.1 Priorites UI/UX

- Garder la lisibilite de shyv (actions courtes, peu de friction).
- Garder la profondeur de LoG sur les vues detail (tier list, counters, side stats).

## 4.2 Priorites data

- Maintenir des agrégats precomputes (performance UI).
- Exposer des filtres coherents partout: patch, rank, role, region (si disponible).
- Unifier les definitions metriques (winrate/pickrate/banrate/score matchup).

## 4.3 Priorites produit

- Tier list basee sur score matchup (deja engagee).
- Fiche champion orientee decision:
  - score matchup + delta patch,
  - matchups details,
  - build/runes/skills/summoners.
- Vue macro "blue vs red" comme panneau d'observabilite meta.

## 5) Checklist benchmark (a conserver)

- [ ] Patch + volume de matchs visibles en permanence.
- [ ] Filtres unifies sur toutes les tabs stats.
- [ ] Tier list triable (score, delta, winrate, pickrate, banrate).
- [ ] Fiche champion complete avec blocs gameplay actionnables.
- [ ] Vue side objectives (blue/red) avec differences lisibles.
- [ ] Navigation rapide stats <-> champion <-> build.
