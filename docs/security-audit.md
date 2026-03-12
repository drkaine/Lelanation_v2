# Audit de sécurité (tour du projet)

Ce document résume les points de sécurité vérifiés et les recommandations.

---

## 1. Secrets et configuration

- **`.env` et `ecosystem.config.js`**  
  Les fichiers `.env` et `ecosystem.config.js` sont listés dans `.gitignore`. Ne jamais les committer. Utiliser des variables d’environnement (ou un secret manager en prod) pour :
  - `RIOT_API_KEY`, `ADMIN_PASSWORD`, `YOUTUBE_API_KEY`, `DISCORD_WEBHOOK_URL`, etc.
- **Exemple**  
  `example.ecosystem.config.js` utilise des placeholders (`API-KEY`) ; s’en inspirer pour toute config versionnée.
- **Admin**  
  L’admin utilise Basic Auth avec `ADMIN_USER_NAME` / `ADMIN_PASSWORD`. Le token est renvoyé côté front (localStorage). En cas de XSS, un attaquant pourrait le voler ; pour une surface admin plus sensible, envisager des cookies httpOnly ou une session serveur.

---

## 2. Path traversal (corrigé)

- **Route `/api/images/:version/:type/{*filename}`**  
  Une vérification basée uniquement sur `path.join()` et `startsWith(baseDir)` ne protège pas contre les séquences `../` dans `filename`, car `join()` ne normalise pas les `..`.  
  **Correction appliquée** : utilisation de `path.resolve()` sur le chemin construit et comparaison avec le répertoire de base résolu ; lecture du fichier via le chemin résolu. Voir `backend/src/routes/images.ts`.

---

## 3. SQL et requêtes brutes

- **`$queryRawUnsafe` / `$executeRawUnsafe`**  
  Utilisés dans `StatsOverviewService`, `StatsSummonerSpellsService`, `StatsPrecomputedService`, `StatsAbandonsService`.
  - Les appels avec paramètres positionnels (`$1`, `$2`) et valeurs passées séparément sont sûrs (pas d’injection).
  - **`buildMatchCond(version, rankTier)`** : les valeurs sont échappées pour les guillemets simples (`esc(s)`), ce qui évite l’injection SQL classique. En revanche, `version` / `rankTier` peuvent contenir des caractères spéciaux pour `LIKE` (`%`, `_`), ce qui peut élargir les résultats. **Recommandation** : valider ou restreindre les valeurs (ex. liste de versions/ranks autorisés) avant de les passer à `buildMatchCond`.
- **REFRESH MATERIALIZED VIEW**  
  Les noms de vues sont des constantes en dur (`mv_stats_champions`, etc.), pas d’entrée utilisateur → pas de risque.

---

## 4. XSS et contenu HTML

- **`v-html`**  
  Utilisé pour :
  - Pages légales / confidentialité : contenu i18n (fichiers JSON) → considéré de confiance tant que les JSON ne sont pas modifiés par une entrée utilisateur.
  - Descriptions de builds / runes / sorts : données de jeu ou descriptions formatées.
- **`linkifyDescription()`**  
  Le texte est d’abord échappé (HTML), puis les URLs sont transformées en liens. Utilisation cohérente pour éviter l’injection de HTML/JS via les descriptions.

---

## 5. CORS et en-têtes

- **Backend**  
  `app.use(cors())` sans options → toute origine est autorisée. En production, restreindre si besoin à des origines connues (ex. domaine du front).
- **En-têtes de sécurité**  
  Pas de Helmet ni d’en-têtes explicites (X-Content-Type-Options, CSP, etc.). À envisager pour durcir les réponses HTTP.

---

## 6. Dépendances

- Des overrides de sécurité (ex. `serialize-javascript`, `minimatch`) sont déjà présents dans le `package.json` racine. Exécuter régulièrement `npm audit` et traiter les vulnérabilités restantes.

---

## 7. Résumé des actions

| Élément                         | Statut / action                                      |
|---------------------------------|------------------------------------------------------|
| Path traversal `/api/images`    | Corrigé (résolution de chemin + contrôle de base)   |
| Secrets dans le repo            | À éviter : .env et ecosystem.config.js ignorés      |
| SQL (paramètres / buildMatchCond)| Paramètres OK ; recommandation : whitelist version/rank |
| v-html / linkifyDescription    | Contrôlé (échappement + contenu de confiance)        |
| CORS / Helmet                  | Optionnel : restreindre origines + en-têtes en prod  |
| Auth admin (localStorage)      | Acceptable ; renforcer (cookie httpOnly) si besoin   |

---

*Dernière revue : mars 2025.*
