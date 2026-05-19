# Accès à la base de données

Le backend et le poller-v2 utilisent une **seule** base PostgreSQL : `lelanation_statistiques` (agrégats partitionnés par `patch`, `players`, `processed_matches`, etc.).

---

## Connexion

```env
# backend/.env — port 5434 via Docker (service postgres-statistiques)
DATABASE_URL="postgresql://lelanation:lelanation@localhost:5434/lelanation_statistiques"
```

| Paramètre | Valeur |
|-----------|--------|
| User | `lelanation` |
| Password | `lelanation` |
| Database | `lelanation_statistiques` |
| Port (Docker) | `5434` |

---

## Démarrer PostgreSQL (Docker)

```bash
docker compose up -d
make migrate-db   # Drizzle : backend/drizzle/migrations
```

```bash
docker exec -it lelanation-postgres-statistiques psql -U lelanation -d lelanation_statistiques
```

Studio Drizzle :

```bash
cd backend && npm run drizzle:statistiques:studio
```

---

## Ancienne base `lelanation_stats`

Supprimée du stack applicatif. Pas de migration de données : le poller-v2 alimente directement `lelanation_statistiques`.
