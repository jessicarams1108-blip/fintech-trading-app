/**
 * Minimal API surface for the trading prototype with Postgres-backed deposits.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import http from "node:http";
import { Server as SocketIOServer } from "socket.io";
import jwt from "jsonwebtoken";
import { env } from "./env.js";
import { ensureDbReady } from "./db/ensureDbReady.js";
import { pgHost, pool } from "./db/index.js";
import { getIdentitySchemaStatus } from "./lib/dbSchema.js";
import {
  createAdminDepositRoutes,
  createPublicDepositRoutes,
} from "./routes/deposits.js";
import { createAdminOpsRoutes } from "./routes/adminOps.js";
import { createAdminIdentityRoutes } from "./routes/adminIdentity.js";
import { authRouter } from "./routes/auth.js";
import { liquidityRouter } from "./routes/liquidity.js";
import { kycRouter } from "./routes/kyc.js";
import { borrowRouter } from "./routes/borrow.js";
import { portfolioRouter } from "./routes/portfolio.js";
import { transfersRouter } from "./routes/transfers.js";
import { watchlistRouter } from "./routes/watchlist.js";
import { historyRouter } from "./routes/history.js";
import { notificationsRouter } from "./routes/notifications.js";
import { identityRouter } from "./routes/identity.js";
import { settingsRouter } from "./routes/settings.js";
import { getUsdPrices } from "./lib/market.js";
import { marketRouter } from "./routes/market.js";
import { fixedSavingsRouter } from "./routes/fixedSavings.js";
import { walletRouter } from "./routes/wallet.js";
import { createAdminFixedSavingsRoutes } from "./routes/adminFixedSavings.js";
import { aiTradingRouter } from "./routes/aiTrading.js";
import { createAdminAiTradingRoutes } from "./routes/adminAiTrading.js";
import { startFixedSavingsCron } from "./jobs/fixedSavingsCron.js";

/** Built Vite app (`npm run build -w web`), resolved from `server/dist/index.js`. */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIST = path.resolve(__dirname, "../../web/dist");
const webIndexHtml = path.join(WEB_DIST, "index.html");
const serveWeb =
  fs.existsSync(webIndexHtml) &&
  fs.statSync(webIndexHtml).isFile();

/** Comma-separated `APP_ORIGIN` entries, or allow all origins when unset (local dev). */
function corsOriginOption(): boolean | string[] {
  const raw = env.APP_ORIGIN?.trim();
  if (!raw) return true;
  const list = raw.split(",").map((s) => s.trim()).filter(Boolean);
  return list.length > 0 ? list : true;
}

const corsOrigins = corsOriginOption();
const app = express();
const server = http.createServer(app);

const io = new SocketIOServer(server, {
  path: "/socket.io",
  cors: {
    origin: corsOrigins,
    credentials: true,
  },
});

io.use((socket, next) => {
  const token =
    typeof socket.handshake.auth?.token === "string"
      ? socket.handshake.auth.token
      : typeof socket.handshake.headers.authorization === "string"
        ? socket.handshake.headers.authorization.replace(/^Bearer\s+/i, "")
        : "";

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload & { email?: string; sub?: string };
    const id = decoded.sub ?? "";
    if (!id) throw new jwt.JsonWebTokenError("missing subject");

    socket.join(`user:${id}`);
    socket.emit("system:welcome", { message: "Subscribed using verified session." });
    next();
  } catch {
    next(new Error("Unauthorized socket handshake"));
  }
});

io.on("connection", (_socket) => {
  /** Additional per-socket workflows (market streams) plug in here. */
});

setInterval(() => {
  void (async () => {
    try {
      const px = await getUsdPrices();
      io.emit("market:prices", px);
    } catch {
      /* ignore */
    }
  })();
}, 25_000);

app.use(helmet());
app.use(cors({ origin: corsOrigins, credentials: true }));
app.use(express.json({ limit: "8mb" }));

const depositLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/market", marketRouter);
app.use("/api/auth", authRouter);
app.use("/api/liquidity", liquidityRouter);
app.use("/api/kyc", kycRouter);
app.use("/api/borrow", borrowRouter);
app.use("/api/portfolio", portfolioRouter);
app.use("/api/transfers", transfersRouter);
app.use("/api/watchlist", watchlistRouter);
app.use("/api/history", historyRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/identity", identityRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/fixed-plans", fixedSavingsRouter);
app.use("/api/ai-trading", aiTradingRouter);
app.use("/api/wallet", walletRouter);
app.use("/api/deposit", depositLimiter, createPublicDepositRoutes());
app.use("/api/admin", createAdminDepositRoutes(io));
app.use("/api/admin", createAdminOpsRoutes(io));
app.use("/api/admin", createAdminIdentityRoutes());
app.use("/api/admin", createAdminFixedSavingsRoutes());
app.use("/api/admin", createAdminAiTradingRoutes());

if (serveWeb) {
  app.use(express.static(WEB_DIST, { index: false }));
  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (req.path.startsWith("/api") || req.path.startsWith("/socket.io")) return next();
    res.sendFile(webIndexHtml, (err) => next(err));
  });
}

app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    const message = err instanceof Error ? err.message : "Unexpected error";
    console.error("[Express error]", err);

    const clientSafe =
      /deposit not pending|missing unexpectedly/i.test(message) ||
      message === "Malformed transaction identifier for asset" ||
      /KYC columns are missing|Identity verification table is missing|User profile columns are missing|npm run db:(sql|migrate)/i.test(message) ||
      /Insufficient wallet balance|Insufficient balance|Insufficient CashBox|Amount exceeds|Amount must be|Duration must be|Plan not found|Identity verification must be approved|Not yet matured|Subscription not found|Recipient not found|Borrow position not active|Invalid borrow position|Watchlist not available|Username not allowed|Username is taken|Current password incorrect/i.test(
        message,
      );

    if (clientSafe) {
      res.status(400).json({ error: message });
      return;
    }

    if (/ECONNREFUSED|connection terminated|timeout expired|ENOTFOUND/i.test(message)) {
      res.status(503).json({ error: "Database is not available. Try again in a moment." });
      return;
    }

    res.status(500).json({
      error: "Internal server error",
      ...(process.env.NODE_ENV !== "production" ? { detail: message } : {}),
    });
  },
);

/** Bind on 0.0.0.0; Railway sets PORT — local dev falls back to 5000. */
const listenPortRaw = process.env.PORT;
const parsed = Number.parseInt(String(listenPortRaw ?? ""), 10);
const listenPort =
  listenPortRaw !== undefined && listenPortRaw !== "" && Number.isFinite(parsed) && parsed > 0 ? parsed : 5000;

async function startServer(): Promise<void> {
  await verifyPostgresWithRetry();
  try {
    await ensureDbReady();
  } catch (err) {
    console.error("[Startup] Database migration check failed:", err);
  }

  startFixedSavingsCron();

  server.listen(listenPort, "0.0.0.0", () => {
    console.log(`[Startup] Listening on 0.0.0.0:${listenPort} (process.env.PORT=${listenPortRaw ?? "unset"} → using ${listenPort})`);
    console.log(
      serveWeb
        ? `API + Socket.IO + web (static ${WEB_DIST}) on 0.0.0.0:${listenPort}`
        : `API + Socket.IO on 0.0.0.0:${listenPort} (no web dist at ${WEB_DIST} — run npm run build -w web)`,
    );
  });
}

function formatConnectError(err: unknown): string {
  if (err instanceof AggregateError) {
    const parts = err.errors.map((e) => formatConnectError(e)).filter(Boolean);
    return parts.length > 0 ? parts.join("; ") : err.message || "AggregateError";
  }
  if (err && typeof err === "object") {
    const e = err as { message?: string; code?: string };
    if (e.message?.trim()) return e.message;
    if (e.code) return `code=${e.code}`;
  }
  return String(err);
}

/** Retry Postgres in background; do not exit — avoids Render crash loop while DATABASE_URL is fixed. */
async function verifyPostgresWithRetry(): Promise<void> {
  const dbHost = pgHost(env.DATABASE_URL);
  const looksInternal = /^dpg-[a-z0-9-]+$/i.test(dbHost);
  console.log(
    `[Startup] DATABASE_URL host=${dbHost || "(unparseable)"} internal=${looksInternal} — use Render **Internal** URL from fintech-trading-db`,
  );

  const delayMs = 2_000;
  let attempt = 0;
  for (;;) {
    attempt += 1;
    try {
      await pool.query("SELECT NOW() AS now");
      console.log("[Startup] Postgres connection OK");
      return;
    } catch (err) {
      console.error(
        `[Startup] Postgres attempt ${attempt} failed (host=${dbHost}): ${formatConnectError(err)}`,
      );
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}
void startServer();
