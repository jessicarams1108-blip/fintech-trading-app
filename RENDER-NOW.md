# Render setup (Attempt 1 or 2) — API + Postgres

**Your plan:** Vercel = website (`theoove.com`). Render = API + database. Railway can be deleted after Render works.

If **two** full Render tries fail, say **"Render failed twice"** in chat — we will remove Railway/Render from the repo and start the **Vercel-only** migration path.

---

## Before you start

1. Push this repo to GitHub (`main`).
2. In [Railway](https://railway.app): optional — pause or delete the old `fintech-trading-app` service so you are not confused by two backends.
3. Keep **Vercel** as-is for the frontend.

---

## Attempt 1 — Blueprint (recommended)

1. Go to [dashboard.render.com](https://dashboard.render.com) → **New +** → **Blueprint**.
2. Connect GitHub repo **`jessicarams1108-blip/fintech-trading-app`**.
3. Render reads **`render.yaml`** and creates:
   - Postgres: `theoove-postgres`
   - Web: `theoove-app`
4. When asked, approve creating resources (Starter plan / Oregon region as in the file).
5. Wait until **`theoove-app`** shows **Live** (not Build failed).

### After first Live deploy

1. Open service **`theoove-app`** → **Shell** → run once:

   ```bash
   npm run db:schema -w server
   ```

2. Open in browser (your URL may differ slightly):

   ```text
   https://theoove-app.onrender.com/health
   ```

   Expected: `{"ok":true}`

3. **Vercel** → Project → **Environment Variables**:
   - `VITE_API_URL` = `https://theoove-app.onrender.com` (no trailing `/`)
4. **Vercel** → **Deployments** → **Redeploy**.

5. Test **https://www.theoove.com** — sign-in / dashboard.

---

## If Blueprint fails — Attempt 2 (manual web service)

1. **New +** → **PostgreSQL** → name `theoove-postgres` → create.
2. **New +** → **Web Service** → same GitHub repo.
3. Settings:

   | Field | Value |
   |--------|--------|
   | Root Directory | *(empty — repo root)* |
   | Runtime | Node |
   | Build Command | `npm ci && npm run build` |
   | Start Command | `npm start` |
   | Health Check Path | `/health` |

4. **Environment**:
   - Link Postgres → `DATABASE_URL` (Internal URL)
   - `JWT_SECRET` = long random string (16+ chars)
   - `APP_ORIGIN` = `https://www.theoove.com,https://theoove.com`
   - `NODE_VERSION` = `20`
   - **Do not set `PORT`**

5. Deploy → Shell → `npm run db:schema -w server` → test `/health` → update Vercel `VITE_API_URL`.

---

## If deploy logs show Postgres errors

| Log | Fix |
|-----|-----|
| `Cannot reach Postgres` | On **web** service, `DATABASE_URL` must be from Render Postgres (`postgresql://...`), not `https://theoove.com` |
| Build fails on `npm ci` | Ensure `package-lock.json` is committed; do not commit `node_modules` |
| Health check failed | Open **Logs** tab (runtime); fix env vars; confirm `/health` after service stays up |

---

## When Render works

1. Vercel: `VITE_API_URL` → `https://theoove-app.onrender.com`
2. You can **delete the Railway project** in railway.app (optional).
3. Tell chat: **"Render is live"** — we can clean up docs if you want.

---

## After 2 failed attempts

Message: **`Render failed twice`**

We will:

1. Remove `railway.toml`, `render.yaml`, and Railway/Render deploy docs from the repo.
2. Start **Vercel-only** architecture (serverless API + hosted Postgres on Vercel/Neon) — larger code change, documented separately.

Track attempts in **`deploy/RENDER-ATTEMPTS.md`**.
