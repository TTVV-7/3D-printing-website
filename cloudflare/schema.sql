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

-- Customer accounts (cloudflare/accounts.js): people sign in with Google or
-- an emailed link; sessions are cookies holding a random token, stored here
-- hashed.
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  picture TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen TEXT
);
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS login_links (token_hash TEXT PRIMARY KEY, email TEXT NOT NULL, next TEXT, expires_at TEXT NOT NULL);

-- Every quote and sticker order, by the email it was sent from, so the
-- customer sees it in their account and the status can be updated.
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  kind TEXT NOT NULL,            -- quote, club, sticker, sticker-request
  title TEXT,
  status TEXT NOT NULL,          -- see STATUSES in cloudflare/accounts.js
  quantity INTEGER,
  total REAL,
  thumbnail TEXT,
  images TEXT,                   -- JSON list of picture links
  note TEXT,                     -- shown to the customer
  tracking TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS orders_email ON orders(email, created_at);
CREATE INDEX IF NOT EXISTS orders_created ON orders(created_at);

-- Sticker designs a signed-in customer put in their cart, to order again.
CREATE TABLE IF NOT EXISTS designs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT,
  preview TEXT,
  data TEXT NOT NULL,            -- the cart item, with links in place of images
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS designs_user ON designs(user_id, created_at);
