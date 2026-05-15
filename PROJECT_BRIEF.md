# Oove — project brief

## Goal

Ship **Oove.com**: an Aave-inspired marketing landing plus an **in-app liquidity experience** (supply, borrow, portfolio, transfers, watchlist, history, identity, settings), with a **first-run onboarding path**: carousel → multi-step signup → email verification → dashboard.

## Tech stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, React Router, **TanStack Query**, Lightweight Charts, `socket.io-client`, `qrcode.react`.
- **Backend:** Node / Express 5, Postgres (`pg`), JWT auth, **Socket.IO** (price fan-out), optional **Resend** for verification email.
- **Market data:** CoinGecko simple price API with static fallbacks (`server/src/lib/market.ts`).

## What is done

### Marketing & onboarding

- **Landing (`/`):** `web/src/pages/OoveLandingPage.tsx` — Aave-style marketing; CTAs to **`/onboarding`**.
- **Onboarding → Signup → Verify → Login** as before (`web/src/pages/onboarding`, `signup`, `VerifyEmailPage`, `LoginPage`).
- **Backend auth:** `server/src/routes/auth.ts` — register, verify, resend OTP, login, session (gated), `/me`, logout. **Sessions:** `user_sessions` rows created on successful **login**, **verify**, and **passwordless session** mint.

### App shell & navigation

- **`AppShell`:** Home, Borrow, Portfolio, Transfers, Supply (deposit), Watchlist, History, Identity, Settings, Admin (if operator email).
- **TanStack Query** wired in `web/src/providers/QueryProvider.tsx` → `web/src/main.tsx`.

### Dashboard & liquidity

- **`/dashboard`:** Liquidity hero, **What to do next**, **Recent deposit activity**, summary cards (supplied, outstanding borrow, **remaining borrow capacity**, **net supply APY estimate**).
- **`GET /api/liquidity/summary`:** Supplies `outstandingBorrowUsd`, `grossMaxBorrowUsd`, `maxBorrowUsd` (**available headroom** after outstanding debt), `netSupplyApyPct`, wallets. **Resilience:** missing `kyc_*` columns → defaults; deposit activity tolerates missing `declared_amount_usd`.

### Supply (deposits)

- **`/deposit`:** QR, declared USD (min $100), tx hash, admin queue (`server/src/routes/deposits.ts`, migrations `003`–`005` related columns).

### Borrow

- **`/borrow`:** Split UI — borrow form (stable borrow **USDC/USDT/DAI** MVP), APRs, review modal; collateral summary; repay modal; history table.
- **API:** `GET /api/borrow/power`, `GET /api/borrow/rates`, `POST /api/borrow/request`, `POST /api/borrow/repay`.
- **DB:** `borrow_positions`; interest accrual on read (`touchBorrowAccrual`); disbursement credits wallet + ledger.

### Portfolio

- **`/portfolio`:** Total value, 24h change vs snapshots, **line chart** from `GET /api/portfolio/history`, holdings table from `GET /api/portfolio/holdings`, allocation, quick links.
- **API:** `GET /api/portfolio/summary`, `/holdings`, `/history?range=…`.
- **DB:** `portfolio_holdings`, `portfolio_snapshots` (daily upsert on summary load).

### Transfers

- **`/transfers`:** Tabs Deposit (treasury + QR), Withdraw (queue), Send (internal transfer by email), Receive; recent withdrawals list.
- **API:** `GET /api/transfers/deposit/address`, `POST /withdraw`, `POST /send`, `GET /history`.
- **DB:** `withdrawal_requests`.

### Watchlist

- **`/watchlist`:** Add/remove symbols, grid with live prices when CoinGecko succeeds.
- **API:** `GET /api/watchlist`, `POST /api/watchlist/add`, `DELETE /api/watchlist/:symbol`.
- **DB:** `watchlist_items`.

### History

- **`/history`:** Filters, paginated table, CSV export; plus recent deposit strip.
- **API:** `GET /api/history?type=&page=&pageSize=` — merges ledger, deposits, withdrawals, borrows.

### Identity

- **`/verify-identity`:** KYC status + demo verify + **document list** from `GET /api/identity/status`.
- **API:** `GET /api/identity/status`, `POST /api/identity/upload` (demo presign), `POST /api/identity/submit`.
- **DB:** `verification_documents` (optional until migration applied).

### Settings

- **`/settings`:** Tabs — Profile (PATCH names), Security (change password, sessions list + revoke), Notifications (placeholder), API keys (501), Preferences (theme).
- **API:** `PATCH /api/settings/profile`, `POST /change-password`, `GET /sessions`, `POST /revoke-session`.

### Realtime

- **Socket.IO:** `market:prices` broadcast ~every 25s to all connected clients (`server/src/index.ts`).

### Database

- **Migrations:** `db/migrations/005_oove_platform.sql` — platform tables + wallet currency extension for **USDC/DAI**.
- **`db/schema.sql`:** Updated to match for greenfield installs.

### Admin

- **Deposits queue** unchanged; admin email gate: `ADMIN_PRIMARY_EMAIL` or default **`Hardewusi@gmail.com`** (`server/src/middleware/auth.ts`).

## Next tasks (suggested)

- **Apply migrations** on every environment: `003`, `004`, **`005_oove_platform.sql`** (or refresh from `db/schema.sql`).
- **Production hardening:** S3/R2 presigned uploads, real 2FA (TOTP), API key HMAC, session revocation that invalidates JWTs, admin UI for withdrawals.
- **Tests:** API integration tests for borrow/portfolio edge cases; E2E register → verify → borrow smoke.

## Environment (server)

See root **`.env.example`**: `DATABASE_URL`, `JWT_SECRET`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `OTP_EXPIRY_MINUTES`, `ADMIN_PRIMARY_EMAIL`, `APP_ORIGIN`, `DEV_PASSWORDLESS_SESSION`.

## Local preview

From repo root: `npm run dev:server` + `npm run dev:web` (or `start-all.cmd`). Frontend proxies `/api` and `/socket.io` to the API (see `web/vite.config.ts`).

## Continuing in a new Cursor chat

1. Ensure **Postgres migrations** through **`005`** are applied.
2. Point the agent at **`PROJECT_BRIEF.md`** and the route files under `server/src/routes/`.
3. Name the next slice (e.g. “admin approve withdrawals”, “wire S3 upload”, “E2E for borrow”).
