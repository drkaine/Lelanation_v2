# Migrations longues (stats, vues matérialisées)

Certaines migrations créent des **vues matérialisées** qui scannent toute la base (participants, matchs, etc.). Elles peuvent prendre plusieurs minutes voire des heures selon le volume de données.

## Découpage pour voir l’avancement

La migration `20260311160000_stats_recreate_rest` a été découpée en **4 étapes** :

1. **20260311160000_stats_recreate_rest** — Création des fonctions SQL uniquement (rapide).
2. **20260311160001_stats_mv_champions** — Création de `mv_stats_champions` (peut être long).
3. **20260311160002_stats_mv_overview** — Création de `mv_stats_overview` (peut être long).
4. **20260311160003_stats_mv_overview_teams** — Création de `mv_stats_overview_teams` (peut être long).

À chaque étape, Prisma affiche par exemple :

```text
Applying migration `20260311160001_stats_mv_champions`
```

Vous savez ainsi quelle vue matérialisée est en cours.

## Si une migration est bloquée ou trop longue

### 1. Arrêter la migration

- Dans le terminal où tourne `prisma migrate deploy` : **Ctrl+C**.

### Erreur « migrate found failed migrations » (P3009)

Une migration a été interrompue (timeout, Ctrl+C) et Prisma refuse d’appliquer les suivantes. Il faut la marquer comme **annulée** pour pouvoir la relancer :

```bash
cd backend
npx prisma migrate resolve --rolled-back 20260311160001_stats_mv_champions
```

Remplacez le nom par celui de la migration en échec (affiché dans le message d’erreur). Puis relancez `npx prisma migrate deploy` (ou `make build`). La migration sera réappliquée ; les fichiers 20260311160001–003 utilisent `IF NOT EXISTS`, donc une réexécution est sûre.

### Erreur « Timed out trying to acquire a postgres advisory lock » (P1002)

Si après un Ctrl+C la commande `prisma migrate resolve --rolled-back ...` échoue avec un timeout sur le verrou (advisory lock), une **session PostgreSQL** (souvent l’ancienne migration) détient encore le verrou. Il faut terminer cette session.

**Option A – Avec `psql` (ou un client SQL) : terminer les sessions qui tiennent un verrou consultatif**

```bash
# Adapter l’URL si besoin (port, user, DB)
psql "postgresql://lelanation:lelanation@localhost:5433/lelanation_stats" -c "
  SELECT pg_terminate_backend(l.pid)
  FROM pg_locks l
  JOIN pg_stat_activity a ON a.pid = l.pid
  WHERE l.locktype = 'advisory'
    AND a.pid <> pg_backend_pid();
"
```

Cela ferme les connexions qui détiennent un advisory lock (souvent l’ancienne migration), sans toucher à votre session actuelle.

**Option B – Redémarrer PostgreSQL** (libère tous les verrous) :

```bash
docker compose restart
# ou, si PostgreSQL est un service système : sudo systemctl restart postgresql
```

Ensuite, relancer : `npx prisma migrate resolve --rolled-back <nom_migration>` puis `npx prisma migrate deploy`.

### 2. Marquer la migration comme annulée

Sinon Prisma considère qu’elle est « en cours » et refusera de continuer. À faire **une seule fois** après l’avoir interrompue :

```bash
cd backend
npx prisma migrate resolve --rolled-back 20260311160000_stats_recreate_rest
```

Utilisez le **nom exact** de la migration concernée (celui affiché par Prisma, par ex. `20260311160000_stats_recreate_rest` ou `20260311160001_stats_mv_champions`).

### 3. Relancer le déploiement

```bash
npx prisma migrate deploy
```

Prisma reprendra à la migration en échec (ou à la suivante si vous aviez déjà résolu une migration partiellement appliquée). Chaque migration s’applique une par une, vous voyez l’avancement étape par étape.

## Résumé des commandes

| Action | Commande |
|--------|----------|
| Arrêter une migration en cours | **Ctrl+C** dans le terminal |
| Marquer une migration interrompue comme annulée | `npx prisma migrate resolve --rolled-back <nom_migration>` |
| Appliquer les migrations (avec progression visible) | `npx prisma migrate deploy` |
