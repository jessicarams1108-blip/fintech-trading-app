# Vercel-only fallback (after 2 failed Render attempts)

Triggered when you say: **`Render failed twice`**.

## Honest scope

This app today uses **Express + Socket.IO + Postgres**. Vercel hosts **static/Vite** well; it does **not** run that stack as-is. "Vercel only" means:

1. **Keep** Vercel for `web/` (theoove.com).
2. **Add** hosted Postgres (Vercel Postgres or Neon).
3. **Rewrite** API routes to Vercel Serverless Functions **or** drop Socket.IO and use polling.
4. **Remove** from repo: `railway.toml`, `render.yaml`, Railway/Render sections in deploy docs.

That is a **multi-step code migration**, not a dashboard toggle.

## What the assistant will do on trigger

- [ ] Delete `railway.toml`, `render.yaml`
- [ ] Trim `DEPLOY-PAAS.md` / related docs to Vercel + DB provider only
- [ ] Add Neon/Vercel Postgres + minimal `/api` serverless handlers (phased)
- [ ] Update `VITE_API_URL` / env docs

Until then, prefer finishing **Render attempt 1** using `RENDER-NOW.md`.
