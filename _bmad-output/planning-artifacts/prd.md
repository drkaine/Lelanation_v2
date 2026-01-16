---
stepsCompleted: ['step-01-init', 'step-02-discovery', 'step-03-success', 'step-04-journeys', 'step-05-domain', 'step-06-innovation', 'step-07-project-type', 'step-08-scoping', 'step-09-functional', 'step-10-nonfunctional', 'step-11-polish', 'step-e-01-discovery', 'step-e-02-review', 'step-e-03-edit']
lastEdited: '2026-01-14T14:48:04+00:00'
editHistory:
  - date: '2026-01-14T14:48:04+00:00'
    changes: 'Applied validation report improvements: fixed measurability issues (2 FRs, 8 NFRs), removed implementation leakage (3 instances)'
inputDocuments: 
  - 'docs/index.md'
  - 'docs/project-overview.md'
  - 'docs/architecture-backend.md'
  - 'docs/architecture-frontend.md'
  - 'docs/technology-stack.md'
  - 'docs/source-tree-analysis.md'
  - 'docs/api-contracts-backend.md'
  - 'docs/data-models.md'
  - 'docs/component-inventory-frontend.md'
  - 'docs/integration-architecture.md'
documentCounts:
  briefCount: 0
  researchCount: 0
  brainstormingCount: 0
  projectDocsCount: 10
classification:
  projectType: web_app_mpa
  domain: gaming
  complexity: medium_high
  projectContext: brownfield
workflowType: 'prd'
---

# Product Requirements Document - Lelanation

**Author:** Darkaine
**Date:** 2026-01-14T10:41:16+00:00

## Executive Summary

Lelanation v2 est une refonte complète de la plateforme de builds League of Legends, transformant une SPA en MPA pour améliorer le SEO et offrir une expérience utilisateur optimale. La plateforme permet aux joueurs de créer, optimiser et partager des builds avec des calculs de statistiques en temps réel.

**Différenciateur clé :** Plateforme de référence en français combinant créateur de builds, outil de theorycraft, et statistiques au même endroit, avec partage facilité et synchronisation automatique des données de jeu.

**Vision :** Devenir la plateforme de référence en français pour tous les outils League of Legends, rassemblant theorycraft, statistiques, builds et guides dans une interface unifiée.

**Cible :** Communauté Lelariva et joueurs francophones de League of Legends (casual et compétitifs).

**Approche MVP :** Experience MVP - offrir une expérience complète dès le lancement avec au moins autant de fonctionnalités que la v1, une UX améliorée et sans bugs.

## Success Criteria

### User Success

Les utilisateurs considèrent Lelanation v2 comme un succès lorsqu'ils peuvent :

- **Trouver un build** : Localiser un build existant qui correspond à leurs besoins en moins de 3 minutes
- **Créer un build** : Créer un build complet et fonctionnel en moins de 3 minutes
- **Partager facilement** : Partager leurs builds avec la communauté en un seul clic
- **Résoudre les problèmes de la v1** : 
  - Les données synchronisées depuis le backend s'affichent correctement dans le frontend
  - Les vidéos YouTube sont correctement synchronisées et visibles
  - Les bugs graphiques et UI sont corrigés
  - Les problèmes d'optimisation sont résolus

**Moment "aha!"** : Utilisateur crée, optimise et partage un build complet en moins de 3 minutes avec données à jour et outil de theorycraft fonctionnel.

### Business Success

**Objectifs à 3 mois :**
- **500 utilisateurs réguliers** : Utilisateurs qui reviennent au moins 3 fois par mois
- **50 builds créés** : Au moins 50 builds créés par la communauté
- **Engagement** : Établir une base d'utilisateurs actifs et engagés

**Objectifs à 12 mois :**
- **Croissance de 20% par mois** : Augmentation régulière du nombre d'utilisateurs réguliers
- **Communauté active** : Base d'utilisateurs qui crée et partage régulièrement des builds
- **Visibilité** : Lelanation devient une référence pour les builds League of Legends en français

**Métriques clés :**
- Nombre d'utilisateurs réguliers (actifs ≥ 3 fois/mois)
- Nombre de builds créés
- Taux de partage des builds
- Taux de rétention mensuel

### Technical Success

**SEO (Search Engine Optimization) :**
- **Objectif** : Top 10 pour "build league of legends" en 6 mois
- **Migration SPA → MPA** : Amélioration significative du référencement grâce à la structure MPA
- **Visibilité** : Meilleure indexation des pages de builds, champions, et statistiques

**Fiabilité :**
- **Uptime** : 99.5% de disponibilité
- **Synchronisation** : Correction des bugs de synchronisation backend/frontend
- **Stabilité** : Résolution des bugs critiques de la v1

**Performance :**
- **Temps de chargement** : < 2 secondes pour le chargement d'une page
- **Temps de réponse API** : < 500ms pour les requêtes API
- **Optimisation** : Amélioration des performances générales par rapport à la v1

**Scalabilité :**
- **Capacité** : Support de 10k+ utilisateurs simultanés
- **Architecture** : Architecture scalable et optimisée

### Measurable Outcomes

**Métriques utilisateur :**
- Temps moyen pour trouver un build : < 3 minutes
- Temps moyen pour créer un build : < 3 minutes
- Taux de partage des builds : À mesurer après lancement
- Satisfaction utilisateur : À mesurer via feedback

**Métriques business :**
- Utilisateurs réguliers (3 mois) : 500
- Croissance mensuelle (12 mois) : 20%
- Builds créés (3 mois) : 50
- Taux de rétention mensuel : À mesurer

**Métriques techniques :**
- Classement SEO (6 mois) : Top 10 pour "build league of legends"
- Uptime : 99.5%
- Temps de chargement page : < 2 secondes
- Temps de réponse API : < 500ms

## Product Scope

### MVP - Minimum Viable Product

Le MVP inclut les fonctionnalités essentielles pour être utilisable et meilleure que la v1 :

**1. Créateur de Build avec Calculs de Stats en Temps Réel**
- Interface de création de build intuitive
- Calculs de statistiques en temps réel lors de la sélection d'items, runes, etc.
- Validation des builds avec les bonnes valeurs
- Correction des bugs de synchronisation backend/frontend

**2. Bibliothèque de Partage avec Recherche et Filtres**
- Bibliothèque de builds partagés par la communauté
- Recherche de builds (par champion, items, runes, etc.)
- Filtres avancés pour trouver des builds spécifiques
- Partage simple et rapide des builds créés

**3. Outil de Theorycraft avec Analyses Avancées**
- Outil de theorycraft fonctionnel avec analyses avancées
- Calculs de stats détaillés
- Optimisation de builds
- Comparaison de builds

**4. Corrections Critiques de la v1**
- Synchronisation backend/frontend fonctionnelle
- Affichage correct des données mises à jour
- Synchronisation et affichage des vidéos YouTube
- Correction des bugs graphiques et UI majeurs
- Amélioration des performances

**5. Migration SPA → MPA pour SEO**
- Structure MPA pour améliorer le référencement
- Pages dédiées pour builds, champions, statistiques
- Optimisation SEO de base

### Growth Features (Post-MVP)

Fonctionnalités qui rendent Lelanation compétitif et attractif :

**1. Statistiques Détaillées**
- Statistiques des objets utilisés en jeu
- Statistiques des champions
- Statistiques des builds populaires
- Analyses de tendances

**2. Informations OTP (One-Trick-Ponies)**
- Profils OTP avec statistiques détaillées
- Builds recommandés par OTP
- Analyses de gameplay OTP

**3. Outil de Theorycraft Amélioré**
- Analyses plus approfondies
- Comparaisons avancées
- Recommandations intelligentes
- Simulations de gameplay

**4. Améliorations SEO Avancées**
- Optimisation SEO approfondie
- Contenu optimisé pour les moteurs de recherche
- Rich snippets et structured data

**5. Améliorations UI/UX**
- Design amélioré et moderne
- Expérience utilisateur optimisée
- Animations et transitions fluides

### Vision (Future)

La vision à long terme de Lelanation est de devenir **la plateforme de référence en français** pour tous les outils League of Legends :

**Compilation des Outils Disponibles**
- Rassembler tous les outils utiles pour League of Legends au même endroit
- Outils de theorycraft, statistiques, builds, guides, etc.
- Interface unifiée et cohérente

**Avantages Clés**
- **En français** : Accessible à la communauté francophone
- **Centralisé** : Tous les outils au même endroit
- **Partage facilité** : Partage simple et rapide de builds et analyses
- **Communauté** : Plateforme pour la communauté Lelariva et au-delà

**Fonctionnalités Vision**
- Suite complète d'outils de theorycraft
- Statistiques complètes et détaillées
- Guides et ressources
- Communauté active et engagée
- Intégrations avec d'autres plateformes (YouTube, Twitch, etc.)

## User Journeys

### Journey 1 : Créateur de Builds - Création et Partage

**Persona :** Alex, 25 ans, joueur régulier de League of Legends, suit Lelariva sur YouTube. Il joue principalement en ranked et veut optimiser ses builds pour améliorer ses performances.

**Scène d'ouverture :**
Alex vient de regarder une vidéo de Lelariva sur un nouveau build pour son champion principal. Il veut créer ce build sur Lelanation pour voir les stats exactes et pouvoir le partager avec ses amis. Il a une idée précise du build mais veut vérifier les calculs de stats avant de l'utiliser en jeu.

**Action montante :**
1. Alex arrive sur Lelanation depuis son mobile (design mobile-first)
2. Il clique sur "Créer un build" dans le menu
3. Il sélectionne son champion dans la liste (recherche rapide disponible)
4. Il commence à sélectionner les items - les stats se mettent à jour en temps réel
5. Il choisit les runes principales et secondaires - les calculs de stats continuent de s'ajuster
6. Il sélectionne les sorts d'invocateur et les shards
7. Il définit l'ordre de montée des compétences
8. Il voit les stats finales calculées : dégâts, résistances, vitesse d'attaque, etc.
9. Il ajuste quelques items pour optimiser selon ses préférences de gameplay
10. Il valide son build - le système vérifie que toutes les valeurs sont correctes

**Climax :**
Alex crée son build complet en moins de 3 minutes. Il voit immédiatement toutes les statistiques calculées avec précision. Il clique sur "Partager" et obtient un lien unique qu'il peut envoyer à ses amis ou publier. Le build est sauvegardé dans sa bibliothèque personnelle.

**Résolution :**
Le build est maintenant disponible dans la bibliothèque publique. Alex peut le retrouver facilement plus tard. D'autres joueurs peuvent le découvrir, l'utiliser, et même le copier pour le modifier. Alex se sent satisfait d'avoir créé un build optimisé rapidement et de pouvoir le partager facilement.

**Émotions :** Frustration initiale (besoin de vérifier les stats) → Curiosité (découverte de l'outil) → Satisfaction (création rapide) → Fierté (partage avec la communauté)

**Points de friction potentiels :**
- Si les données ne sont pas à jour (problème de synchronisation backend/frontend)
- Si l'interface est trop complexe ou lente
- Si les calculs de stats ne sont pas précis

**Récupération d'erreur :**
- Si le build ne peut pas être sauvegardé, message d'erreur clair avec possibilité de réessayer
- Si les données sont obsolètes, indication visuelle et option de forcer la mise à jour

---

### Journey 2 : Consommateur de Builds - Recherche et Découverte

**Persona :** Sarah, 22 ans, joue occasionnellement League of Legends. Elle veut essayer un nouveau champion qu'elle ne maîtrise pas encore et cherche un build fiable recommandé par la communauté.

**Scène d'ouverture :**
Sarah a décidé d'apprendre un nouveau champion après l'avoir vu dans une vidéo. Elle ne sait pas quel build utiliser et veut trouver quelque chose de fiable, testé par d'autres joueurs. Elle préfère utiliser un build existant plutôt que de créer le sien.

**Action montante :**
1. Sarah arrive sur Lelanation depuis son ordinateur
2. Elle cherche le nom du champion dans la barre de recherche
3. Elle arrive sur la page du champion avec plusieurs builds disponibles
4. Elle filtre les builds par rôle (elle joue en support)
5. Elle voit une liste de builds avec leurs stats principales affichées
6. Elle clique sur un build qui semble intéressant
7. Elle consulte les détails : items, runes, ordre de compétences, statistiques calculées
8. Elle compare avec un autre build pour voir les différences
9. Elle voit qu'il y a des builds recommandés par des OTP (One-Trick-Ponies) pour ce champion
10. Elle sélectionne un build d'OTP qui correspond à son style de jeu

**Climax :**
Sarah trouve un build adapté en moins de 3 minutes. Elle voit toutes les informations nécessaires : la liste complète des items avec leurs stats, les runes détaillées, l'ordre de montée des compétences, et même des conseils supplémentaires. Elle peut copier ce build pour l'utiliser en jeu.

**Résolution :**
Sarah a maintenant un build prêt à utiliser. Elle peut le sauvegarder dans ses favoris pour y accéder rapidement plus tard. Elle se sent confiante pour essayer ce nouveau champion avec un build optimisé par la communauté.

**Émotions :** Incertitude (quel build choisir ?) → Exploration (découverte des options) → Confiance (build trouvé et validé) → Satisfaction (prêt à jouer)

**Points de friction potentiels :**
- Trop de builds disponibles sans moyen de les filtrer efficacement
- Builds obsolètes ou non mis à jour
- Informations manquantes ou peu claires

**Récupération d'erreur :**
- Si aucun build n'est trouvé, suggestions de champions similaires ou option de créer son propre build
- Si les builds sont obsolètes, indication visuelle de la date de dernière mise à jour

**Variante - Recherche par OTP :**
Sarah peut aussi rechercher spécifiquement les builds des OTP pour un champion. Elle voit les profils des joueurs OTP avec leurs statistiques et leurs builds recommandés, ce qui lui donne encore plus de confiance dans son choix.

---

### Journey 3 : Admin - Monitoring et Surveillance

**Persona :** Darkaine (vous), administrateur de Lelanation. Vous devez surveiller la santé du système, vérifier que les synchronisations fonctionnent, et suivre les métriques d'utilisation.

**Scène d'ouverture :**
Vous voulez vérifier que tout fonctionne correctement après une mise à jour. Vous avez besoin de voir rapidement les statistiques d'utilisation et l'état des systèmes automatisés (cron jobs).

**Action montante :**
1. Vous accédez au panneau admin (authentification requise)
2. Vous arrivez sur le dashboard principal avec les métriques clés
3. Vous consultez les statistiques principales :
   - Nombre total de builds créés
   - Nombre d'utilisateurs actifs
   - Builds créés aujourd'hui/cette semaine
4. Vous vérifiez l'état des cron jobs :
   - Synchronisation Data Dragon (dernière exécution, statut)
   - Synchronisation vidéos YouTube (dernière exécution, nombre de vidéos synchronisées)
   - Maintenance Redis (dernière exécution, statut)
5. Vous consultez les métriques de performance :
   - Uptime du système
   - Temps de réponse API moyen
   - Taux d'erreur
6. Vous accédez à Matomo pour une analyse plus fine des utilisateurs (trafic, comportement, etc.)
7. Vous vérifiez les alertes Discord - aucune alerte récente signifie que tout fonctionne bien

**Climax :**
Vous voyez que tous les systèmes fonctionnent correctement. Les cron jobs se sont exécutés avec succès, les données sont à jour, et les métriques de performance sont dans les normes. Aucune alerte Discord n'a été déclenchée, ce qui confirme que tout est opérationnel.

**Résolution :**
Vous avez une vue d'ensemble complète de la santé du système. Vous pouvez détecter rapidement les problèmes grâce aux alertes Discord. Les statistiques vous permettent de suivre la croissance de la communauté et l'utilisation de la plateforme.

**Émotions :** Préoccupation (vérification nécessaire) → Confiance (tout fonctionne) → Satisfaction (système stable)

**Points de friction potentiels :**
- Interface admin peu claire ou difficile à naviguer
- Métriques manquantes ou peu pertinentes
- Alertes Discord qui ne fonctionnent pas correctement

**Récupération d'erreur :**
- Si un cron job a échoué, alerte Discord immédiate avec détails de l'erreur
- Si les métriques ne sont pas disponibles, indication claire du problème
- Logs détaillés pour investiguer les problèmes

**Alertes Discord :**
- Erreur de synchronisation Data Dragon
- Erreur de synchronisation vidéos YouTube
- Problème de connexion Redis
- Erreur serveur (500, timeout, etc.)
- Uptime en dessous du seuil (99.5%)

---

### Journey Requirements Summary

Ces journeys révèlent les capacités suivantes nécessaires au système :

**Capacités de Création de Builds :**
- Interface de sélection de champion, items, runes, sorts d'invocateur, shards
- Calculs de statistiques en temps réel
- Validation des builds avec vérification des valeurs
- Sauvegarde et partage de builds
- Bibliothèque personnelle de builds créés

**Capacités de Recherche et Découverte :**
- Recherche de builds par champion
- Filtres avancés (rôle, items, runes, popularité)
- Affichage des builds avec stats principales
- Comparaison de builds
- Intégration des builds OTP
- Système de favoris/sauvegarde

**Capacités d'Administration :**
- Dashboard admin avec métriques clés
- Monitoring des cron jobs (état, dernière exécution)
- Métriques de performance (uptime, temps de réponse, taux d'erreur)
- Intégration Matomo pour analyse fine
- Système d'alertes Discord automatisé
- Logs et historique

**Capacités Techniques Requises :**
- Synchronisation backend/frontend fiable
- Calculs de stats précis et en temps réel
- Performance optimale (< 2 secondes par page)
- Système d'alertes robuste
- Monitoring et observabilité complets

## Domain-Specific Requirements

### Compliance & Regulatory

**RGPD (Règlement Général sur la Protection des Données) :**
- **Bandeau de consentement cookies** : Obligatoire pour l'utilisation de localStorage et Matomo
- **Pas de collecte de données personnelles** : Aucune authentification, pas de données personnelles stockées
- **Transparence** : Information claire sur l'utilisation des cookies (localStorage pour les builds utilisateur, Matomo pour l'analyse)
- **Consentement utilisateur** : Bandeau de cookie avec options de consentement (accept/reject)
- **Droit à l'oubli** : Les builds stockés localement peuvent être supprimés par l'utilisateur

**Autres régulations :**
- Aucune autre régulation spécifique (pas de HIPAA, PCI-DSS, etc.)
- Conformité aux standards web généraux

### Technical Constraints

**Intégration API Riot Games Data Dragon :**

- **Endpoint de versions** : Surveillance de `https://ddragon.leagueoflegends.com/api/versions.json` pour détecter les nouvelles versions
- **Pas de rate limit** : Data Dragon n'impose pas de rate limit sur les endpoints publics (CDN)
- **Synchronisation quotidienne** : Mise à jour programmée à 00h00 pour éviter les problèmes de charge
- **Gestion des versions** : Système de détection automatique des nouvelles versions de données
- **Multi-langue** : Support FR et EN pour les données de jeu

**Gestion des données de jeu :**

- **Synchronisation automatique** : Cron job quotidien pour récupérer les dernières données
- **Archivage des builds** : Les builds créés avec d'anciennes versions sont archivés mais restent accessibles
- **Bandeau d'avertissement** : Affichage d'un bandeau "Attention, le build n'est plus à jour" pour les builds obsolètes
- **Modification des builds obsolètes** : Possibilité de modifier un build obsolète pour le mettre à jour avec la version actuelle
- **Validation future** : Vérification des patch notes pour déterminer si les builds sont toujours valides après un patch

**Performance et scalabilité :**

- **Pas de contraintes spécifiques** : Pas de contraintes de performance particulières au domaine gaming
- **Calculs en temps réel** : Les calculs de stats doivent être performants pour une expérience fluide
- **Gestion de charge** : Synchronisation à 00h00 pour éviter les pics de trafic

### Integration Requirements

**API Riot Games Data Dragon :**
- **Endpoint principal** : `https://ddragon.leagueoflegends.com/cdn/`
- **Versions** : `https://ddragon.leagueoflegends.com/api/versions.json`
- **Données synchronisées** :
  - Champions (`championFull.json`)
  - Items (`item.json`)
  - Runes (`runesReforged.json`)
  - Sorts d'invocateur (`summoner.json`)
  - Cartes (`map.json`)
- **Langues supportées** : FR (`fr_FR`), EN (`en_US`)
- **Format** : JSON

**YouTube API (pour vidéos) :**
- Synchronisation automatique via cron jobs
- Gestion des créateurs de contenu (liste modifiable par admin)
- Mise à jour automatique des vidéos

### Risk Mitigations

**Risques identifiés et mitigations :**

1. **Échec de synchronisation Data Dragon**
   - **Risque** : Données obsolètes, builds invalides
   - **Mitigation** : 
     - Alertes Discord en cas d'erreur
     - Retours d'erreur détaillés pour investigation
     - Résolution manuelle des problèmes
     - Système de retry automatique

2. **Builds obsolètes après patch majeur**
   - **Risque** : Builds invalides, confusion des utilisateurs
   - **Mitigation** :
     - Bandeau d'avertissement sur les builds obsolètes
     - Possibilité de modifier les builds obsolètes
     - Archivage avec accès maintenu
     - Validation future via patch notes pour déterminer la validité

3. **Changements breaking dans l'API Data Dragon**
   - **Risque** : Synchronisation cassée, données manquantes
   - **Mitigation** :
     - Surveillance continue des versions
     - Gestion des erreurs avec retours détaillés
     - Alertes Discord pour investigation rapide
     - Tests de validation après chaque synchronisation

4. **Données non synchronisées (bug actuel v1)**
   - **Risque** : Backend récupère les données mais frontend ne les affiche pas
   - **Mitigation** :
     - Correction du bug de synchronisation backend/frontend
     - Validation de la synchronisation complète
     - Tests de bout en bout pour vérifier l'affichage

5. **Vidéos YouTube non synchronisées (bug actuel v1)**
   - **Risque** : Vidéos non visibles malgré synchronisation backend
   - **Mitigation** :
     - Correction du bug de synchronisation
     - Validation de l'affichage des vidéos
     - Monitoring de la synchronisation YouTube

**Système d'alertes :**
- **Discord** : Alertes automatiques en cas d'erreur de synchronisation, problème serveur, ou échec de cron job
- **Monitoring** : Surveillance continue de l'état des systèmes
- **Résolution** : Processus manuel de résolution des problèmes identifiés par les alertes

### Domain Patterns & Best Practices

**Patterns spécifiques au domaine gaming :**

1. **Gestion des versions de données de jeu**
   - Détection automatique des nouvelles versions
   - Archivage des anciennes versions
   - Migration des builds vers nouvelles versions

2. **Calculs de stats de jeu**
   - Calculs précis basés sur les formules du jeu
   - Mise à jour en temps réel lors de la sélection d'items/runes
   - Validation des combinaisons possibles

3. **Synchronisation périodique**
   - Mise à jour quotidienne à heure fixe (00h00)
   - Éviter les pics de trafic
   - Gestion des échecs avec retry

4. **Compatibilité des builds**
   - Détection des builds obsolètes
   - Avertissement utilisateur
   - Possibilité de mise à jour

**Best practices :**
- Respecter les ToS de Riot Games pour l'utilisation des données
- Maintenir la compatibilité avec les anciennes versions de builds
- Fournir des informations claires sur la validité des builds
- Assurer la disponibilité des données même en cas d'échec de synchronisation

## Web App Specific Requirements

### Project-Type Overview

Lelanation v2 est une application web MPA (Multiple Page Application) optimisée pour tous les navigateurs, avec focus sur SEO, performances et accessibilité. Architecture MPA dès le départ pour améliorer le référencement et l'indexation par les moteurs de recherche et LLM.

### Technical Architecture Considerations

**Architecture MPA :**
- Structure multi-pages pour améliorer le SEO
- Chaque page dédiée (builds, champions, statistiques) est indexable
- Navigation entre pages avec chargement complet (pas de SPA routing)
- Partage d'URLs directes vers des pages spécifiques

**Calculs côté client :**
- Tous les calculs de stats sont effectués côté client (JavaScript)
- Pas de dépendance serveur pour les calculs en temps réel
- Performance optimale avec calculs instantanés
- Réduction de la charge serveur

**Mises à jour en temps réel :**
- Mises à jour des builds partagés visibles immédiatement
- Pas de WebSockets nécessaire (polling ou refresh manuel)
- Calculs de stats en temps réel lors de la sélection d'items/runes

### Browser Support Matrix

**Support universel :**
- Tous les navigateurs modernes supportés
- Chrome (dernières versions)
- Firefox (dernières versions)
- Safari (dernières versions)
- Edge (dernières versions)
- Navigateurs mobiles (Chrome Mobile, Safari Mobile, Firefox Mobile)

**Compatibilité :**
- Support des fonctionnalités JavaScript modernes (ES6+)
- Support des APIs Web modernes (localStorage, Fetch, etc.)
- Progressive Enhancement pour les fonctionnalités avancées
- Fallback pour les navigateurs plus anciens si nécessaire

**Tests requis :**
- Tests sur tous les navigateurs principaux
- Tests sur mobile (iOS et Android)
- Validation des fonctionnalités critiques sur chaque navigateur

### Responsive Design

**Mobile-First :**
- Design mobile-first comme requirement principal
- Interface optimisée pour les petits écrans
- Adaptation progressive vers les écrans plus grands
- Touch-friendly pour les interactions mobiles

**Breakpoints :**
- Mobile : < 768px
- Tablet : 768px - 1024px
- Desktop : > 1024px

**Considérations :**
- Navigation adaptative selon la taille d'écran
- Images et assets optimisés pour mobile
- Performance optimale sur connexions mobiles
- Interface utilisable avec une seule main sur mobile

### Performance Targets

**Temps de chargement :**
- < 2 secondes pour le chargement d'une page (requirement de succès technique)
- < 500ms pour les requêtes API
- Calculs de stats en temps réel sans latence perceptible

**Optimisations requises :**
- Code splitting et lazy loading
- Optimisation des images (WebP, compression)
- Minification et compression des assets
- Mise en cache efficace (HTTP cache, service worker)
- CDN pour les assets statiques

**Métriques de performance :**
- Core Web Vitals optimisés (LCP, FID, CLS)
- Lighthouse score > 90
- Performance optimale sur mobile et desktop

### SEO Strategy

**Objectif :** Top 10 pour "build league of legends" en 6 mois

**Indexation :**
- **Toutes les pages indexables** sauf les pages admin
- Pages de builds individuels indexables
- Pages de champions indexables
- Pages de statistiques indexables
- Pages de guides/tier lists indexables
- Pages admin exclues de l'indexation (robots.txt)

**Optimisations SEO :**
- **Sitemap XML** : Génération automatique du sitemap avec toutes les pages indexables
- **robots.txt** : Configuration pour exclure les pages admin et guider les crawlers
- **Indexation pour LLM** : Optimisation pour l'indexation par les LLM (structured data, meta tags)
- **Structured Data** : Schema.org markup pour les builds, champions, items
- **Meta tags** : Title, description, Open Graph, Twitter Cards optimisés
- **URLs SEO-friendly** : URLs descriptives et lisibles (/builds/champion-name/build-name)
- **Contenu optimisé** : Contenu riche et pertinent pour les mots-clés ciblés

**Pages prioritaires :**
- Page d'accueil
- Pages de builds populaires
- Pages de champions populaires
- Pages de statistiques

**Stratégie de contenu :**
- Contenu unique pour chaque build
- Descriptions détaillées des builds
- Tags et catégories pour l'organisation
- Mise à jour régulière du contenu

### Accessibility Level

**Conformité WCAG :**
- **Niveau WCAG AA** minimum requis
- Support complet des lecteurs d'écran
- Navigation au clavier complète et fonctionnelle

**Exigences d'accessibilité :**
- **Navigation clavier** : Toutes les fonctionnalités accessibles au clavier
- **Lecteurs d'écran** : Support complet (ARIA labels, roles, descriptions)
- **Contraste** : Ratio de contraste conforme WCAG AA (4.5:1 pour le texte)
- **Focus visible** : Indicateurs de focus clairs et visibles
- **Alt text** : Images avec texte alternatif descriptif
- **Formulaires** : Labels associés, messages d'erreur accessibles
- **Structure sémantique** : HTML sémantique (headings, landmarks, etc.)

**Tests d'accessibilité :**
- Tests avec lecteurs d'écran (NVDA, JAWS, VoiceOver)
- Tests de navigation clavier
- Validation automatique (axe-core, Lighthouse)
- Tests manuels avec utilisateurs en situation de handicap

**Fonctionnalités accessibles :**
- Création de builds accessible au clavier
- Recherche et filtres accessibles
- Partage de builds accessible
- Consultation des statistiques accessible

### Implementation Considerations

**Migration SPA → MPA :**
- Refactoring de l'architecture de routing
- Génération de pages statiques ou SSR pour le SEO
- Gestion des états entre pages
- Optimisation des transitions entre pages

**Calculs côté client :**
- Bibliothèque de calculs optimisée
- Cache des résultats de calculs
- Gestion de la mémoire pour les calculs complexes
- Performance des calculs sur mobile

**Mises à jour en temps réel :**
- Stratégie de polling pour les mises à jour
- Refresh manuel disponible
- Indicateurs visuels pour les nouvelles données
- Gestion des conflits de données

**SEO Implementation :**
- Génération automatique du sitemap
- Configuration robots.txt dynamique
- Structured data pour chaque type de contenu
- Meta tags dynamiques par page
- Optimisation pour les LLM (format de données structuré)

**Accessibilité Implementation :**
- Intégration des attributs ARIA
- Tests d'accessibilité dans le pipeline CI/CD
- Documentation des patterns d'accessibilité
- Formation de l'équipe sur les bonnes pratiques

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach : Experience MVP**

Lelanation v2 suit une approche **Experience MVP** : expérience complète dès le lancement plutôt qu'un produit minimal. Objectif : au moins autant de fonctionnalités que la v1, avec UX améliorée et sans bugs.

**Justification :**
- **Contexte brownfield** : Refonte complète de la v1, donc opportunité de créer une expérience optimale dès le début
- **Objectif de rétention** : Une bonne UX et l'absence de bugs sont essentielles pour que les utilisateurs reviennent
- **Différenciation** : L'expérience utilisateur est un facteur clé de différenciation par rapport aux concurrents
- **Validation rapide** : Avoir des builds générés par les utilisateurs dès le premier mois valide l'adoption

**Resource Requirements :**
- Équipe de développement (backend + frontend)
- Automatisation complète (pas de processus manuels)
- Scripts de synchronisation améliorés depuis la v1

**Critères de succès MVP :**
- **10 utilisateurs actifs** dans le premier mois
- **Builds générés** par la communauté
- **UX fluide** sans bugs majeurs
- **Au moins autant de features** que la v1

### MVP Feature Set (Phase 1)

**Core User Journeys Supported :**

1. **Créateur de Builds** (Journey 1) - ✅ Must-Have
   - Création complète de builds avec calculs de stats en temps réel
   - Interface intuitive et rapide (< 3 minutes pour créer un build)
   - Partage simple (lien unique)
   - Sauvegarde locale (localStorage)

2. **Consommateur de Builds** (Journey 2) - ✅ Must-Have
   - Recherche de builds par champion
   - Filtres de base (rôle, items principaux)
   - Affichage des builds avec stats principales
   - Consultation des détails d'un build

3. **Admin** (Journey 3) - ✅ Must-Have
   - Dashboard avec métriques de base
   - Monitoring des cron jobs
   - Alertes Discord en cas d'erreur

**Must-Have Capabilities :**

**1. Créateur de Build avec Calculs de Stats en Temps Réel** ✅
- Interface de création de build intuitive et mobile-first
- Calculs de statistiques en temps réel lors de la sélection d'items, runes, sorts
- Validation des builds avec les bonnes valeurs
- Sauvegarde locale (localStorage)
- Partage via lien unique

**2. Outil de Theorycraft avec Analyses Avancées** ✅
- Calculs de stats détaillés en temps réel
- Optimisation de builds (ajustements selon les stats)
- Comparaison de builds (basique)
- Analyses avancées des statistiques

**3. Bibliothèque de Builds avec Recherche et Filtres** ⚠️ (Simplifié pour MVP)
- **MVP :** Recherche de builds par champion, affichage des builds partagés
- **Post-MVP :** Filtres avancés, bibliothèque complète avec partage communautaire
- **Note :** Le partage simple (lien) est suffisant pour le MVP, la bibliothèque complète peut être ajoutée en Phase 2

**4. Corrections Critiques de la v1** ✅
- Synchronisation backend/frontend fonctionnelle
- Affichage correct des données mises à jour
- Synchronisation et affichage des vidéos YouTube (automatisée)
- Correction des bugs graphiques et UI majeurs
- Amélioration des performances

**5. Migration SPA → MPA pour SEO** ✅
- Architecture MPA dès le départ (pas de migration progressive)
- Pages dédiées pour builds, champions, statistiques
- Optimisation SEO de base (sitemap, robots.txt, meta tags)
- Indexation pour LLM

**6. Synchronisation Automatique** ✅
- Synchronisation Data Dragon quotidienne (scripts v1 améliorés)
- Synchronisation vidéos YouTube automatique
- Cron jobs fonctionnels avec alertes Discord
- Gestion des erreurs et retry automatique

**7. UX et Design** ✅
- Design mobile-first, sobre et épuré (ton League of Legends)
- Interface sans bugs majeurs
- Performance optimale (< 2 secondes par page)
- Accessibilité WCAG AA

**8. Compliance RGPD** ✅
- Bandeau de consentement cookies (localStorage + Matomo)
- Transparence sur l'utilisation des données

**Features Exclues du MVP :**
- Bibliothèque de partage communautaire complète (Phase 2)
- Statistiques détaillées avancées (Phase 2)
- Informations OTP (Phase 2)
- Theorycraft avancé avec simulations (Phase 2)

### Post-MVP Features

**Phase 2 (Growth) - Objectif : 3-6 mois après MVP**

**1. Bibliothèque de Partage Communautaire Complète**
- Bibliothèque publique de builds partagés
- Filtres avancés (rôle, items, runes, popularité, date)
- Système de favoris et sauvegarde
- Recherche avancée avec plusieurs critères

**2. Statistiques Détaillées**
- Statistiques des objets utilisés en jeu
- Statistiques des champions
- Statistiques des builds populaires
- Analyses de tendances

**3. Informations OTP (One-Trick-Ponies)**
- Profils OTP avec statistiques détaillées
- Builds recommandés par OTP
- Analyses de gameplay OTP
- Filtres pour trouver les OTP

**4. Outil de Theorycraft Amélioré**
- Analyses plus approfondies
- Comparaisons avancées entre builds
- Recommandations intelligentes
- Simulations de gameplay

**5. Améliorations SEO Avancées**
- Optimisation SEO approfondie
- Contenu optimisé pour les moteurs de recherche
- Rich snippets et structured data avancés
- Optimisation pour les LLM

**6. Améliorations UI/UX**
- Design amélioré et moderne
- Animations et transitions fluides
- Expérience utilisateur optimisée
- Personnalisation de l'interface

**Phase 3 (Expansion) - Objectif : 12+ mois**

**1. Plateforme Complète d'Outils**
- Suite complète d'outils de theorycraft
- Guides et ressources
- Intégrations avec d'autres plateformes (YouTube, Twitch)
- Communauté active et engagée

**2. Fonctionnalités Avancées**
- API publique pour développeurs
- Intégrations tierces
- Outils de collaboration
- Fonctionnalités sociales avancées

### Risk Mitigation Strategy

**Technical Risks :**

**Risque : Complexité de la migration SPA → MPA**
- **Mitigation :** Architecture MPA dès le départ (pas de migration), utilisation de frameworks adaptés (Vue Router avec mode MPA)
- **Fallback :** Si trop complexe, commencer avec une structure hybride et évoluer progressivement

**Risque : Synchronisation Data Dragon défaillante**
- **Mitigation :** Scripts v1 améliorés avec gestion d'erreurs robuste, alertes Discord, retry automatique
- **Fallback :** Version fixe des données en cas d'échec prolongé, mise à jour manuelle si nécessaire

**Risque : Performance des calculs côté client**
- **Mitigation :** Optimisation des algorithmes de calcul, cache des résultats, tests de performance
- **Fallback :** Calculs serveur pour les cas complexes si nécessaire

**Market Risks :**

**Risque : Adoption faible (moins de 10 users le premier mois)**
- **Mitigation :** UX excellente dès le départ, partage facilité, SEO optimisé
- **Validation :** Métriques d'adoption suivies dès le lancement, ajustements rapides si nécessaire
- **Fallback :** Marketing ciblé communauté Lelariva, partenariats avec créateurs de contenu

**Risque : Différenciation insuffisante**
- **Mitigation :** Focus sur l'expérience utilisateur, outils en français, compilation d'outils au même endroit
- **Validation :** Feedback utilisateurs dès le MVP, améliorations basées sur les retours

**Resource Risks :**

**Risque : Ressources limitées pour le développement**
- **Mitigation :** Automatisation complète (pas de processus manuels), réutilisation des scripts v1
- **Fallback :** Scope MVP réduit si nécessaire, focus sur les fonctionnalités critiques uniquement

**Risque : Maintenance des cron jobs et synchronisations**
- **Mitigation :** Automatisation complète, monitoring et alertes, documentation claire
- **Fallback :** Processus de récupération documenté, intervention manuelle si nécessaire

**Validation Approach :**

**MVP Validation :**
- **10 utilisateurs actifs** dans le premier mois
- **Builds générés** par la communauté
- **Métriques d'engagement** (temps sur site, builds créés, partages)
- **Feedback utilisateurs** pour identifier les améliorations prioritaires

**Success Metrics :**
- Nombre d'utilisateurs actifs
- Nombre de builds créés
- Taux de rétention (utilisateurs qui reviennent)
- Temps moyen pour créer/trouver un build (< 3 minutes)
- Satisfaction utilisateur (feedback qualitatif)

## Functional Requirements

### Build Creation & Management

- FR1: Users can create a new build by selecting a champion
- FR2: Users can select items for their build from the available item list
- FR3: Users can select primary and secondary runes for their build
- FR4: Users can select summoner spells for their build
- FR5: Users can select rune shards for their build
- FR6: Users can define the skill order (ability upgrade sequence) for their build
- FR7: Users can see calculated statistics update in real-time as they modify their build
- FR8: Users can save their build locally (browser storage)
- FR9: Users can modify an existing saved build
- FR10: Users can delete a saved build
- FR11: Users can share their build via a unique link
- FR12: Users can copy a build from a shared link
- FR13: Users can validate that their build configuration is correct before saving
- FR14: Users can see a warning when viewing or modifying an outdated build (created with old game version)

### Build Discovery & Search

- FR15: Users can search for builds by champion name
- FR16: Users can view a list of available builds for a specific champion
- FR17: Users can filter builds by role (top, jungle, mid, adc, support)
- FR18: Users can filter builds by main items
- FR19: Users can view build details including items, runes, summoner spells, and skill order
- FR20: Users can view calculated statistics for a build
- FR21: Users can compare 2 or more builds side-by-side
- FR22: Users can see which builds are most popular (by view count) or recently created (by creation date)
- FR23: Users can access builds shared by other users via unique links

### Theorycraft & Analysis

- FR24: Users can see detailed statistics calculated for their build (damage, resistances, attack speed, etc.)
- FR25: Users can see how statistics change when modifying items or runes
- FR26: Users can optimize their build by adjusting items based on calculated statistics
- FR27: Users can compare statistics between different builds
- FR28: Users can see advanced analysis of build statistics
- FR29: Users can see recommendations for build improvements based on statistics

### Data Synchronization

- FR30: The system can automatically synchronize game data (champions, items, runes, spells) from Riot Games Data Dragon API
- FR31: The system can detect new game versions from Data Dragon API
- FR32: The system can automatically synchronize YouTube videos from configured content creators
- FR33: The system can update video lists when new videos are published by content creators
- FR34: The system can handle synchronization errors and retry failed synchronizations
- FR35: The system can notify administrators when synchronization fails
- FR36: Users can see when game data was last synchronized
- FR37: Users can see if their build uses outdated game data

### Content Management

- FR38: Users can view YouTube videos from League of Legends content creators
- FR39: Users can see a list of videos organized by content creator
- FR40: Administrators can configure the list of content creators whose videos should be synchronized
- FR41: The system can automatically update the video list when new videos are available
- FR42: Users can access shared builds through unique links without authentication

### Administration & Monitoring

- FR43: Administrators can access an admin dashboard
- FR44: Administrators can view total number of builds created
- FR45: Administrators can view number of active users
- FR46: Administrators can view builds created today/this week
- FR47: Administrators can view the status of cron jobs (Data Dragon sync, YouTube sync, cache maintenance)
- FR48: Administrators can see when each cron job last executed
- FR49: Administrators can view system performance metrics (uptime, API response time, error rate)
- FR50: Administrators can receive Discord alerts when system errors occur
- FR51: Administrators can access detailed analytics through Matomo integration

### User Experience & Accessibility

- FR52: Users can access the application from mobile devices with a mobile-optimized interface
- FR53: Users can navigate the application using keyboard only
- FR54: Users with screen readers can access all application features
- FR55: Users can access the application in French language
- FR56: Users can access the application in English language
- FR57: Users can see cookie consent banner and manage cookie preferences
- FR58: Users can understand what data is collected and how it's used

### SEO & Discoverability

- FR59: Search engines can index all public pages (except admin pages)
- FR60: Search engines can access sitemap.xml with all indexable pages
- FR61: Search engines can read robots.txt configuration
- FR62: LLMs can index and understand page content through structured data
- FR63: Each build page has unique, SEO-friendly URL
- FR64: Each champion page has unique, SEO-friendly URL
- FR65: Each page includes appropriate meta tags for search engines and social sharing

### Build Archive & Version Management

- FR66: The system can archive builds created with old game versions
- FR67: Users can still access archived builds (created with old game versions)
- FR68: Users can see a warning banner on outdated builds
- FR69: Users can update an outdated build to use current game version data
- FR70: The system can maintain compatibility information for builds across game versions

## Non-Functional Requirements

### Performance

**Page Load Performance:**
- Page load time must be < 2 seconds for any page (requirement from success criteria)
- API response time must be < 500ms for any API endpoint (requirement from success criteria)
- Real-time statistics calculations must complete within 500ms when users modify builds
- Initial page render must be < 1 second to provide immediate feedback

**Concurrent User Performance:**
- System must support 1,000 concurrent users initially without performance degradation
- System must scale to support 10,000+ concurrent users (requirement from success criteria)
- Performance degradation must be < 10% when scaling from 1k to 10k users

**Traffic Spike Handling:**
- System must handle traffic spikes during:
  - Major game patches (new champion releases, major balance changes)
  - Beginning of year (season start)
  - Content creator video publications
- Performance must remain within acceptable limits (< 2s page load, < 500ms API) during traffic spikes

**Client-Side Performance:**
- Statistics calculations must be performed client-side for optimal performance
- Build creation and modification must feel responsive (< 100ms perceived latency)
- Mobile performance must be within 10% of desktop performance for page load time and API response time

### Scalability

**Initial Capacity:**
- System must support 1,000 concurrent users at launch
- Architecture must be designed to scale horizontally to support 10x load increase

**Growth Capacity:**
- System must scale to support 10,000+ concurrent users (requirement from success criteria)
- Scalability must support 20% monthly growth rate (requirement from success criteria)
- Scaling must not require changes to core architecture components

**Data Scalability:**
- Build storage must scale to support 10,000+ builds without performance impact
- Synchronization processes must scale to handle increasing data volumes
- File-based storage architecture must maintain < 500ms read/write latency as data grows

**Resource Scalability:**
- System must scale compute resources independently from storage
- Caching system must scale to handle increased load
- Static assets must be delivered with optimal performance globally (page load time < 2s for 95th percentile users worldwide)

### Reliability

**Uptime:**
- System uptime must be ≥ 99.5% (requirement from success criteria)
- Planned maintenance windows must be minimal and scheduled during low-traffic periods
- Unplanned downtime must be < 4.38 hours per month (to maintain 99.5% uptime)

**Error Handling:**
- System must handle up to 1 synchronization error per day without user impact
- Automatic retry mechanism must attempt failed operations up to 10 times
- Failed synchronizations must not prevent users from accessing the application
- Users must be able to use the application even if external APIs (Data Dragon, YouTube) are temporarily unavailable

**Data Consistency:**
- Build data must remain consistent even if synchronization fails
- Users must be able to access their saved builds even during synchronization failures
- System must gracefully degrade when external data sources are unavailable

**Monitoring & Alerting:**
- System must provide real-time monitoring of system health
- Discord alerts must be sent immediately when critical errors occur
- Cron job failures must be detected and reported within 5 minutes
- System must log all errors for investigation and resolution

### Integration

**External API Integration:**
- Data Dragon API integration must handle rate limits and API changes gracefully
- YouTube API integration must handle API rate limits and quota restrictions
- Integration failures must not prevent core application functionality
- System must download and store data locally, eliminating need for real-time API calls during user interactions

**Error Tolerance:**
- System must tolerate up to 1 integration error per day
- Automatic retry mechanism must attempt failed integrations up to 10 times before reporting failure
- Failed integrations must trigger Discord alerts for administrator notification
- System must continue operating with cached data when external APIs are unavailable

**Data Synchronization:**
- Daily synchronization must complete successfully or report failure within 24 hours
- Synchronization failures must not affect user access to existing data
- System must maintain data versioning to support rollback if synchronization introduces errors

### Accessibility

**WCAG Compliance:**
- System must comply with WCAG 2.1 Level AA standards (requirement from web app requirements)
- All functionality must be accessible via keyboard navigation
- Screen readers must be able to access and understand all application features
- Color contrast ratios must meet WCAG AA standards (4.5:1 for normal text, 3:1 for large text)

**Keyboard Navigation:**
- All interactive elements must be accessible via keyboard
- Focus indicators must be clearly visible
- Tab order must follow visual reading order (left-to-right, top-to-bottom) and be announced correctly by screen readers
- Keyboard shortcuts must not conflict with browser or assistive technology shortcuts

**Screen Reader Support:**
- All images must have descriptive alt text
- Form inputs must have associated labels
- ARIA labels and roles must be used appropriately
- Dynamic content updates must be announced to screen readers

**Mobile Accessibility:**
- Touch targets must be at least 44x44 pixels
- Interface must be usable with assistive technologies on mobile devices
- Mobile interface must maintain accessibility features equivalent to desktop

### Security

**Data Protection:**
- No personal data is collected or stored (no authentication system)
- Build data stored locally (localStorage) is user-controlled
- Shared builds use UUID-based links (sufficient security for non-sensitive data)
- No database means no risk of data breaches from database attacks

**Cookie & Privacy:**
- Cookie consent banner must be displayed for localStorage and Matomo usage (RGPD requirement)
- Users must be able to accept or reject cookies
- Privacy policy must clearly explain data usage
- No tracking without user consent

**API Security:**
- All API communications must use HTTPS
- API endpoints must validate input to prevent injection attacks
- Rate limiting must be implemented to prevent abuse
- CORS must be configured appropriately for security

**Content Security:**
- Shared build links (UUIDs) provide sufficient security for non-sensitive content
- No additional encryption needed for build data
- System must prevent malicious content injection in user-generated builds

### Browser & Device Support

**Browser Compatibility:**
- System must support all modern browsers (Chrome, Firefox, Safari, Edge - latest versions)
- System must support mobile browsers (Chrome Mobile, Safari Mobile, Firefox Mobile)
- Progressive enhancement must ensure core functionality works on older browsers
- JavaScript must degrade gracefully if disabled

**Device Support:**
- System must be fully functional on mobile devices (mobile-first design)
- Touch interactions must be supported and optimized
- Responsive design must adapt to all screen sizes (mobile, tablet, desktop)
- Performance must be equivalent across devices
