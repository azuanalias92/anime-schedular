import { Hono } from "hono";
import { cors } from "hono/cors";
import { generateToken, verifyToken, extractToken } from "./auth";

type Bindings = {
  DB: D1Database;
  GOOGLE_CLIENT_ID: string;
  JWT_SECRET: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// CORS — allow AniCount origins
app.use(
  "*",
  cors({
    origin: [
      "https://anime-schedular.vercel.app",
      "https://anicount.vercel.app",
      "http://localhost:5173",
      "http://localhost:4173",
    ],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400,
  })
);

// ─── Health ───────────────────────────────────────────────────────────────────
app.get("/", (c) => c.json({ ok: true, name: "anicount-api" }));

// ─── Google Auth ──────────────────────────────────────────────────────────────
app.post("/auth/google", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const credential = typeof body.credential === "string" ? body.credential : "";

  if (!credential) {
    return c.json({ error: "missing_credential" }, 400);
  }

  // Verify Google ID token
  const tokenInfoRes = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
  );

  if (!tokenInfoRes.ok) {
    return c.json({ error: "invalid_google_token" }, 401);
  }

  const tokenInfo = (await tokenInfoRes.json()) as {
    email?: string;
    name?: string;
    picture?: string;
    aud?: string;
    email_verified?: string;
  };

  // Verify audience matches our client ID
  if (tokenInfo.aud !== c.env.GOOGLE_CLIENT_ID) {
    return c.json({ error: "invalid_audience" }, 401);
  }

  if (tokenInfo.email_verified !== "true") {
    return c.json({ error: "email_not_verified" }, 401);
  }

  const email = tokenInfo.email!;
  const name = tokenInfo.name || email.split("@")[0];
  const avatarUrl = tokenInfo.picture || "";
  const userId = crypto.randomUUID();
  const now = new Date().toISOString();
  const jwtSecret = c.env.JWT_SECRET;

  // Ensure schema
  await c.env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      avatar_url TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`
  ).run();

  await c.env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS watchlists (
      user_id TEXT NOT NULL,
      mal_id INTEGER NOT NULL,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, mal_id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`
  ).run();

  // Upsert user
  const existing = await c.env.DB.prepare(
    "SELECT id, name, avatar_url FROM users WHERE email = ?"
  ).bind(email).first<{ id: string; name: string; avatar_url: string }>();

  let finalUserId: string;

  if (existing) {
    finalUserId = existing.id;
    await c.env.DB.prepare(
      "UPDATE users SET name = ?, avatar_url = ?, updated_at = ? WHERE id = ?"
    ).bind(name, avatarUrl, now, finalUserId).run();
  } else {
    finalUserId = userId;
    await c.env.DB.prepare(
      "INSERT INTO users (id, email, name, avatar_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(finalUserId, email, name, avatarUrl, now, now).run();
  }

  // Generate JWT
  const token = await generateToken(
    { sub: finalUserId, email, name },
    jwtSecret
  );

  return c.json({
    token,
    user: { id: finalUserId, email, name, avatarUrl },
  });
});

// ─── Auth middleware ───────────────────────────────────────────────────────────
async function requireAuth(
  c: { env: Bindings; req: { header: (name: string) => string | undefined }; json: (body: unknown, status?: number) => Response },
  next: () => Promise<void>
) {
  const token = extractToken({ headers: { get: (n: string) => c.req.header(n) || null } } as Request);
  if (!token) return c.json({ error: "unauthorized" }, 401);

  const payload = await verifyToken(token, c.env.JWT_SECRET);
  if (!payload) return c.json({ error: "invalid_token" }, 401);

  c.set("userId", payload.sub);
  c.set("userEmail", payload.email);
  await next();
}

// ─── Watchlist API ────────────────────────────────────────────────────────────
app.get("/watchlist", requireAuth, async (c) => {
  const userId = c.get("userId") as string;

  const result = await c.env.DB.prepare(
    "SELECT mal_id, data FROM watchlists WHERE user_id = ? ORDER BY updated_at DESC"
  ).bind(userId).all<{ mal_id: number; data: string }>();

  const items = (result.results || []).map((row) => ({
    malId: row.mal_id,
    ...JSON.parse(row.data),
  }));

  return c.json({ items });
});

app.put("/watchlist", requireAuth, async (c) => {
  const userId = c.get("userId") as string;
  const body = await c.req.json().catch(() => ({}));
  const items = Array.isArray(body.items) ? body.items : [];

  if (items.length === 0) {
    return c.json({ error: "empty_watchlist" }, 400);
  }

  const now = new Date().toISOString();

  // Replace entire watchlist in a transaction
  const statements = [
    c.env.DB.prepare("DELETE FROM watchlists WHERE user_id = ?").bind(userId),
    ...items.map((item: { malId: number; [key: string]: unknown }) => {
      const { malId, ...rest } = item;
      return c.env.DB.prepare(
        "INSERT INTO watchlists (user_id, mal_id, data, updated_at) VALUES (?, ?, ?, ?)"
      ).bind(userId, malId, JSON.stringify(rest), now);
    }),
  ];

  await c.env.DB.batch(statements);

  return c.json({ ok: true, count: items.length, updatedAt: now });
});

export default app;
