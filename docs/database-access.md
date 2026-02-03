# Accès à la base de données

Ce document décrit comment se connecter à la base PostgreSQL utilisée par le backend (stats LoL : matchs, participants, joueurs, etc.).

---

## Connexion

### Variable d’environnement

Le backend utilise **Prisma** avec une URL de connexion dans `backend/.env` :

```env
# Format standard PostgreSQL (Prisma / @prisma/adapter-pg)
# Avec Docker : port 5433 (mappé depuis 5432 du conteneur)
DATABASE_URL="postgresql://lelanation:lelanation@localhost:5433/lelanation_stats"

# PostgreSQL local sur port par défaut :
# DATABASE_URL="postgresql://lelanation:lelanation@localhost:5432/lelanation_stats"
```

- **User** : `lelanation`
- **Password** : `lelanation`
- **Database** : `lelanation_stats`
- **Port** : `5433` si PostgreSQL tourne via Docker (`docker compose up -d`), sinon `5432` en local.

---

## Démarrer PostgreSQL (Docker)

Si la base tourne avec Docker Compose :

```bash
# À la racine du projet
docker compose up -d

# Vérifier que le conteneur est prêt
docker compose ps
```

Puis appliquer les migrations :

```bash
cd backend
npx prisma migrate deploy
```

---

## Méthodes d’accès

### 1. Prisma Studio (recommandé en dev)

Interface web pour parcourir et modifier les données :

```bash
cd backend
npx prisma studio
```

Ouvre par défaut **http://localhost:5555**. La connexion utilise `DATABASE_URL` du fichier `.env` (ou `prisma/schema.prisma`).

### 2. Ligne de commande `psql`

Avec PostgreSQL en Docker :

```bash
docker exec -it lelanation-postgres psql -U lelanation -d lelanation_stats
```

En local (PostgreSQL installé sur la machine) :

```bash
psql -h localhost -p 5433 -U lelanation -d lelanation_stats
# ou port 5432 si PostgreSQL écoute sur le port par défaut
```

Mot de passe par défaut : `lelanation`.

Commandes utiles une fois connecté :

```sql
\dt              -- lister les tables
\d "players"     -- décrire la table players
\q               -- quitter
```

### 3. Client graphique (DBeaver, pgAdmin, etc.)

Utiliser les paramètres suivants :

| Paramètre | Valeur |
|-----------|--------|
| Host     | `localhost` |
| Port     | `5433` (Docker) ou `5432` (local) |
| Database | `lelanation_stats` |
| User     | `lelanation` |
| Password | `lelanation` |

- **DBeaver** : Nouvelle connexion → PostgreSQL → renseigner les champs ci‑dessus.
- **pgAdmin** : Create Server → Connection : host, port, database, username, password.

---

## Schéma et tables

Le schéma est défini dans `backend/prisma/schema.prisma`. Principales tables :

- **matches** – Matchs Ranked Solo/Duo (Match-v5).
- **participants** – Un joueur par match (puuid, champion, rôle, items, runes, rang, etc.).
- **players** – Joueurs agrégés (puuid, summoner_name, region, current_rank_tier, total_games, etc.).
- **champion_player_stats** – Stats par joueur et par champion.
- **seed_players** – Joueurs seed admin pour la collecte.
- **puuid_crawl_queue** – File des PUUID à traiter par le cron.

Détails des modèles : voir `backend/prisma/schema.prisma` et [Data Models](./data-models.md) (à jour avec le schéma Prisma si documenté).

---

## Dépannage

- **Connexion refusée** : vérifier que PostgreSQL tourne (`docker compose ps` ou `systemctl status postgresql`) et que le port (5433 ou 5432) est correct.
- **Authentication failed** : vérifier user/mot de passe dans `.env` et dans `docker-compose.yml` (ou config PostgreSQL locale).
- **Database does not exist** : lancer `npx prisma migrate deploy` depuis `backend/` après avoir créé le conteneur ou la base.
