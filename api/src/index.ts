import { Hono } from "hono";
import { cors } from "hono/cors";
import { generateToken, verifyToken, extractToken } from "./auth";
import { verifyGoogleIdToken } from "./google";

type Bindings = {
  DB: D1Database;
  GOOGLE_CLIENT_ID: string;
  JWT_SECRET: string;
};

type Variables = {
  userId: string;
};

const MAX_WATCHLIST_ITEMS = 500;

// AniCount frontends: allowed for CORS and as redirect-login return targets.
const APP_ORIGINS = [
  "https://anicount.vercel.app",
  "https://anime-schedular.vercel.app",
  "http://localhost:5173",
  "http://localhost:4173",
];

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// CORS — allow AniCount origins
app.use(
  "*",
  cors({
    origin: APP_ORIGINS,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400,
  })
);

// ─── Schema ───────────────────────────────────────────────────────────────────
// Runs once per isolate rather than on every request.
let schemaReady: Promise<void> | null = null;

async function createSchema(db: D1Database): Promise<void> {
  await db.batch([
    db.prepare(
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        avatar_url TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`
    ),
    db.prepare(
      `CREATE TABLE IF NOT EXISTS watchlists (
        user_id TEXT NOT NULL,
        mal_id INTEGER NOT NULL,
        data TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (user_id, mal_id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`
    ),
    // Tracks when each user's list last changed, including changes to an empty list.
    db.prepare(
      `CREATE TABLE IF NOT EXISTS watchlist_meta (
        user_id TEXT PRIMARY KEY,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`
    ),
  ]);

  // Older databases predate google_sub; SQLite has no ADD COLUMN IF NOT EXISTS.
  try {
    await db.prepare("ALTER TABLE users ADD COLUMN google_sub TEXT").run();
  } catch (err) {
    if (!String(err).includes("duplicate column")) throw err;
  }
  await db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS users_google_sub ON users (google_sub)").run();
}

app.use("*", async (c, next) => {
  schemaReady ??= createSchema(c.env.DB).catch((err) => {
    schemaReady = null;
    throw err;
  });
  await schemaReady;
  await next();
});

// ─── Health ───────────────────────────────────────────────────────────────────
app.get("/", (c) => c.json({ ok: true, name: "anicount-api" }));

// ─── Google Auth ──────────────────────────────────────────────────────────────
type SignInResult =
  | { ok: true; nonce: string | undefined; token: string; user: { id: string; email: string; name: string; avatarUrl: string } }
  | { ok: false; error: "missing_credential" | "invalid_google_token" | "email_not_verified" };

async function signInWithGoogle(env: Bindings, credential: string): Promise<SignInResult> {
  if (!credential) {
    return { ok: false, error: "missing_credential" };
  }

  const claims = await verifyGoogleIdToken(credential, env.GOOGLE_CLIENT_ID);

  if (!claims) {
    return { ok: false, error: "invalid_google_token" };
  }

  if (!claims.email || claims.email_verified !== true) {
    return { ok: false, error: "email_not_verified" };
  }

  const email = claims.email;
  const name = claims.name || email.split("@")[0];
  const avatarUrl = claims.picture || "";
  const now = new Date().toISOString();

  // Match on Google's stable account id; fall back to email to link accounts
  // created before google_sub was stored.
  const existing =
    (await env.DB.prepare("SELECT id FROM users WHERE google_sub = ?").bind(claims.sub).first<{ id: string }>()) ??
    (await env.DB.prepare("SELECT id FROM users WHERE email = ? AND google_sub IS NULL").bind(email).first<{ id: string }>());

  let userId: string;

  if (existing) {
    userId = existing.id;
    await env.DB.prepare(
      "UPDATE users SET google_sub = ?, email = ?, name = ?, avatar_url = ?, updated_at = ? WHERE id = ?"
    ).bind(claims.sub, email, name, avatarUrl, now, userId).run();
  } else {
    userId = crypto.randomUUID();
    await env.DB.prepare(
      "INSERT INTO users (id, google_sub, email, name, avatar_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).bind(userId, claims.sub, email, name, avatarUrl, now, now).run();
  }

  // Generate JWT
  const token = await generateToken({ sub: userId, email, name }, env.JWT_SECRET);

  return { ok: true, nonce: claims.nonce, token, user: { id: userId, email, name, avatarUrl } };
}

// Popup sign-in: kept for app versions still cached by the service worker.
app.post("/auth/google", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const result = await signInWithGoogle(c.env, typeof body.credential === "string" ? body.credential : "");

  if (!result.ok) {
    return c.json({ error: result.error }, result.error === "missing_credential" ? 400 : 401);
  }

  return c.json({ token: result.token, user: result.user });
});

// Redirect sign-in: Google posts the credential here as a form, then the user is
// sent back to the app with the session in the URL fragment, which never reaches a server.
// Google's g_csrf_token cookie lives on the app's domain and is not sent here, so the
// app instead checks that the nonce it generated comes back unchanged. The nonce is
// "<random>.<app origin>", which also tells us which frontend to return to.
app.post("/auth/google/redirect", async (c) => {
  const form = await c.req.formData().catch(() => null);
  const credential = form?.get("credential");
  const result = await signInWithGoogle(c.env, typeof credential === "string" ? credential : "");

  const nonce = result.ok ? result.nonce ?? "" : "";
  let nonceOrigin = "";
  try {
    nonceOrigin = decodeURIComponent(nonce.slice(nonce.indexOf(".") + 1));
  } catch {
    // Malformed nonce: fall back to the production app, where the nonce check fails.
  }
  const origin = APP_ORIGINS.includes(nonceOrigin) ? nonceOrigin : APP_ORIGINS[0];

  const fragment = result.ok
    ? new URLSearchParams({ auth: JSON.stringify({ token: result.token, user: result.user, nonce }) })
    : new URLSearchParams({ auth_error: result.error });

  return c.redirect(`${origin}/#${fragment}`, 303);
});

// ─── Auth middleware ───────────────────────────────────────────────────────────
app.use("/watchlist", async (c, next) => {
  const token = extractToken(c.req.header("Authorization"));
  if (!token) return c.json({ error: "unauthorized" }, 401);

  const payload = await verifyToken(token, c.env.JWT_SECRET);
  if (!payload?.sub) return c.json({ error: "invalid_token" }, 401);

  c.set("userId", payload.sub);
  await next();
});

// ─── Watchlist API ────────────────────────────────────────────────────────────
app.get("/watchlist", async (c) => {
  const userId = c.get("userId");

  const [result, meta] = await Promise.all([
    c.env.DB.prepare(
      "SELECT mal_id, data FROM watchlists WHERE user_id = ? ORDER BY updated_at DESC"
    ).bind(userId).all<{ mal_id: number; data: string }>(),
    c.env.DB.prepare("SELECT updated_at FROM watchlist_meta WHERE user_id = ?").bind(userId).first<{ updated_at: string }>(),
  ]);

  const items = (result.results || []).map((row) => ({
    malId: row.mal_id,
    ...JSON.parse(row.data),
  }));

  return c.json({ items, updatedAt: meta?.updated_at ?? null });
});

app.put("/watchlist", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json().catch(() => ({}));

  if (!Array.isArray(body.items)) {
    return c.json({ error: "invalid_watchlist" }, 400);
  }

  // Duplicate ids would violate the primary key and abort the whole batch.
  const byId = new Map<number, { malId: number; [key: string]: unknown }>();
  for (const item of body.items as Array<{ malId?: unknown; [key: string]: unknown }>) {
    if (Number.isInteger(item?.malId)) byId.set(item.malId as number, item as { malId: number; [key: string]: unknown });
  }
  const items = [...byId.values()];

  if (items.length > MAX_WATCHLIST_ITEMS) {
    return c.json({ error: "watchlist_too_large" }, 413);
  }

  const now = new Date().toISOString();

  // Replace entire watchlist in a transaction; an empty list clears it.
  const statements = [
    c.env.DB.prepare("DELETE FROM watchlists WHERE user_id = ?").bind(userId),
    ...items.map(({ malId, ...rest }) =>
      c.env.DB.prepare(
        "INSERT INTO watchlists (user_id, mal_id, data, updated_at) VALUES (?, ?, ?, ?)"
      ).bind(userId, malId, JSON.stringify(rest), now)
    ),
    c.env.DB.prepare(
      "INSERT INTO watchlist_meta (user_id, updated_at) VALUES (?, ?) ON CONFLICT (user_id) DO UPDATE SET updated_at = excluded.updated_at"
    ).bind(userId, now),
  ];

  await c.env.DB.batch(statements);

  return c.json({ ok: true, count: items.length, updatedAt: now });
});

export default app;
