-- Comptes utilisateurs à rôles (admin, lelariva, lelateam), invitations à code, sessions.
CREATE TABLE IF NOT EXISTS app_users (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'lelariva', 'lelateam')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS app_users_username_lower_idx ON app_users (lower(username));
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS app_user_invitations (
  code TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('admin', 'lelariva', 'lelateam')),
  created_by INTEGER REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  used_by INTEGER REFERENCES app_users(id) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS app_user_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS app_user_sessions_user_idx ON app_user_sessions (user_id);
