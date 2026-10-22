-- The printyours D1 database (bound as DB in wrangler.jsonc). Already
-- created; to set up a fresh one:
--   npx wrangler d1 execute printyours --remote --file cloudflare/schema.sql

-- Analytics events from track() (cloudflare/events.js).
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL DEFAULT (datetime('now')),
  name TEXT NOT NULL,
  page TEXT,
  detail TEXT,
  source TEXT
);
CREATE INDEX IF NOT EXISTS events_at ON events(at);
CREATE INDEX IF NOT EXISTS events_name ON events(name, at);
