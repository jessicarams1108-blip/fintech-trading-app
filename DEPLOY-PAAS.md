# Deploy on Railway or Render (no VPS) + use theoove.com

Yes — **both Railway and Render let you attach your own domain** (for example `theoove.com` and `www.theoove.com`). You add a **DNS record** they show you (usually a **CNAME**), wait a few minutes, then they issue **HTTPS** automatically.

This repo is one **Node** app: it serves the **API** and the **built React site** from the same URL. That matches how the frontend calls `/api/...`.

---

## What you need

1. GitHub (or GitLab) with this project pushed.
2. A **Railway** or **Render** account.
3. **Postgres** on the same platform (add a database in the dashboard — they give you `DATABASE_URL`).
4. Your domain’s **DNS** (where you bought `theoove.com`).

---

## Environment variables (both platforms)

Set these in the service **Variables** / **Environment** tab:

| Name | Notes |
|------|--------|
| `DATABASE_URL` | Paste from the platform’s Postgres (or use linking — see below). |
| `JWT_SECRET` | Long random string, **at least 16 characters**. |
| `APP_ORIGIN` | **Comma-separated** exact site URLs, no trailing slashes. Example: `https://theoove.com,https://www.theoove.com` — after you add a custom domain, **update this** to match what users type in the browser. Until then you can use the temporary URL they give you (e.g. `https://something.up.railway.app`) so CORS/Socket.IO work. |
| `PORT` | **Do not set manually** on Render/Railway unless their docs say so — they inject `PORT`. |

Optional: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, S3 vars — see `.env.example`.

---

## First-time database schema

After the **first** successful deploy (Postgres running and `DATABASE_URL` set), apply the SQL schema **once**:

- **Render:** open your web service → **Shell**, then run:  
  `npm run db:schema -w server`
- **Railway:** open the service → **Shell** / terminal, same command.

If tables already exist, that command may error — that is normal; you only need it on a **fresh** database.

---

## Railway (quick path)

**Monorepo root (fixes most “Build failed” errors):** In your **web** service (`theoove-app`), open **Settings → Source** (or **Build → Root directory**). Set **Root directory** to **empty** or **`/`** — the **whole GitHub repo**, not `server` and not `web`. This project’s `npm run build` must see both `web/` and `server/` from the repo root. If Root directory is `server`, the image build will fail.

1. [railway.app](https://railway.app) → **New project** → **Deploy from GitHub** → pick this repo.
2. Add **PostgreSQL** (New → Database → Postgres). Railway usually injects `DATABASE_URL` into your **web** service — confirm under **Variables** that `DATABASE_URL` is present (or reference their “Connect” docs and link the variable).
3. Set **`JWT_SECRET`** and **`APP_ORIGIN`** on the **web** service (see table above).
4. **Settings → Build / Deploy**
   - **Build command:** `npm ci && npm run build`  
   - **Start command:** `npm start`  
   (Root `package.json` includes `"start"` → runs the server.)
5. Deploy. Check **Deploy logs** for errors. Open the generated **`.up.railway.app`** URL and test.
6. **Custom domain:** Service → **Settings → Networking → Public networking** → **Custom domain** → add `theoove.com` (and repeat for `www` if you want). Railway shows **DNS targets** (often **CNAME**). Add those at your registrar, wait for verification, then set **`APP_ORIGIN`** to your real `https://…` URLs and redeploy if needed.

Repo file **`railway.toml`** hints the same build/start commands if the UI is confusing.

---

## Render (quick path)

1. [render.com](https://render.com) → **New** → **Blueprint** (if you use the repo’s `render.yaml`) **or** **Web Service** connected to GitHub.
2. If **manual Web Service**:
   - **Runtime:** Node  
   - **Build command:** `npm ci && npm run build`  
   - **Start command:** `npm start`  
   - **Health check path:** `/health`
3. Create a **PostgreSQL** instance on Render; copy **Internal Database URL** or **External** into `DATABASE_URL` on the web service (or use Render’s “Link database” so it injects automatically).
4. Set **`JWT_SECRET`** and **`APP_ORIGIN`**.
5. After first deploy, run **`npm run db:schema -w server`** once in the **Shell** (see above).
6. **Custom domain:** Service → **Settings → Custom domains** → add `theoove.com`. Render shows **DNS records** to add (CNAME or A). After HTTPS works, align **`APP_ORIGIN`** with `https://theoove.com` (and `www` if used).

The repo includes **`render.yaml`** as a starting blueprint; you can still adjust plans/regions in the Render dashboard.

---

## Custom domain summary (both platforms)

1. Add the domain in **Railway** or **Render**.
2. At your **registrar**, create exactly the **DNS records** they show (usually **CNAME** to their hostname).
3. Wait for **SSL active** (can take a few minutes to an hour).
4. Set **`APP_ORIGIN`** to the **https** URLs you actually use.

---

## Troubleshooting

| Issue | What to check |
|--------|----------------|
| Site loads but API / login fails | `APP_ORIGIN` must include the **exact** browser URL (scheme + host, no path). |
| Build fails | Logs should show Node version — use **Node 20+** (Render: set `NODE_VERSION` to `20` if needed). |
| `Cannot reach Postgres` | `DATABASE_URL` wrong service / not linked / DB still provisioning. |

You cannot skip **some** hosted compute + **Postgres** — Railway/Render **are** the “live” host instead of a VPS; your domain only points at their edge.
