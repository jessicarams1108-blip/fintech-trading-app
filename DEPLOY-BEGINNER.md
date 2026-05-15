# Deploy your app for beginners (theoove.com)

This guide assumes you want **one website** at **https://theoove.com** that shows your React app and talks to your API on the **same** address (recommended for this project).

You will do three big things: **(1) rent a small server**, **(2) point your domain to it**, **(3) copy your project there and run it**.

---

## 0. What “done” looks like

- Opening **https://theoove.com** in a browser shows your app.
- Signing up / logging in works (needs **Postgres** + **env vars** set correctly).
- After you change code on your PC, you **upload again** (see [Section 14](#14-updating-after-you-change-code)) and the site updates.

---

## 1. What you need before you start

| Item | Why |
|------|-----|
| A **domain** (e.g. theoove.com) | So people get a normal link. |
| A **VPS** (virtual server) | A small Linux machine on the internet. Common providers: **DigitalOcean**, **Hetzner**, **Linode**, **Vultr**, **AWS Lightsail**. Pick **Ubuntu 22.04 or 24.04**. **1 GB RAM** is enough to start. |
| **Or: PaaS (no VPS)** | **Railway** or **Render** — see **`DEPLOY-PAAS.md`** in this repo for the same app + custom domain without managing a server. |
| Your **project files** (this repo) | Usually via **Git** + GitHub/GitLab, or zip upload. |

**Postgres:** either install Postgres **on the same VPS** (simplest for learning) or use a **managed** database (Neon, Supabase, Railway Postgres) and put its URL in `DATABASE_URL`.

---

## 2. Create the VPS

1. Sign up at your provider.
2. Create a **Droplet** / **Server** / **Instance**:
   - OS: **Ubuntu 24.04 LTS** (or 22.04).
   - Plan: smallest is fine to try.
3. Add your **SSH key** if the provider asks (recommended). If you skip it, they may email you a **root password**.
4. Note the server’s **public IP address** (four numbers like `167.99.123.45`).

---

## 3. Log in to the server (from your PC)

**Windows (PowerShell):**

```powershell
ssh root@YOUR_SERVER_IP
```

Replace `YOUR_SERVER_IP` with the IP from step 2. The first time, type **yes** if it asks about “authenticity”.

If you use a non-root user later, use `ssh yourname@YOUR_SERVER_IP` instead.

---

## 4. Create a safe Linux user (recommended)

Still on the server as `root`:

```bash
adduser deploy
usermod -aG sudo deploy
```

Set a password when asked.

Log out (`exit`) and log in as **deploy**:

```bash
ssh deploy@YOUR_SERVER_IP
```

From here, use **`deploy`** for installs unless a command must be `sudo`.

---

## 5. Install Node.js 20+

On the server:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs build-essential
node -v
```

You should see **v20.x** or newer.

---

## 6. Install PostgreSQL (simple path)

```bash
sudo apt-get update
sudo apt-get install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

Create a database user and database (replace `a_strong_password_here`):

```bash
sudo -u postgres psql -c "CREATE USER theoove WITH PASSWORD 'a_strong_password_here';"
sudo -u postgres psql -c "CREATE DATABASE trading_app OWNER theoove;"
```

Your `DATABASE_URL` will look like:

```text
postgresql://theoove:a_strong_password_here@127.0.0.1:5432/trading_app
```

*(If you use a managed DB instead, skip this section and paste their connection string.)*

---

## 7. Put your project on the server

**Option A — Git (best):**

```bash
cd ~
sudo mkdir -p /opt/theoove-app
sudo chown $USER:$USER /opt/theoove-app
cd /opt/theoove-app
git clone YOUR_REPO_URL .
```

**Option B — Zip:** upload the project folder with **WinSCP** or **FileZilla** (SFTP) into `/opt/theoove-app`.

---

## 8. Create your `.env` file on the server

```bash
cd /opt/theoove-app
nano .env
```

Paste and edit (no spaces around `=`):

```env
PORT=4000
DATABASE_URL=postgresql://theoove:YOUR_PASSWORD@127.0.0.1:5432/trading_app
JWT_SECRET=use-a-long-random-string-at-least-16-chars
APP_ORIGIN=https://theoove.com,https://www.theoove.com
```

- **`JWT_SECRET`:** generate something long (you can search “password generator”).
- **`APP_ORIGIN`:** must match the **exact** `https://…` addresses people use in the browser (with or without `www` — list both if you use both).

Save in nano: **Ctrl+O**, Enter, **Ctrl+X**.

Copy the same values into `server/.env` **or** keep only the root `.env` (this project loads the root file).

---

## 9. Install dependencies and database schema (first time only)

```bash
cd /opt/theoove-app
npm ci
npm run db:create -w server
npm run db:schema -w server
```

- If `db:schema` says tables already exist, you only run it **once** on a fresh database.

---

## 10. Build and test the app

```bash
cd /opt/theoove-app
npm run build
npm run start -w server
```

You should see a log line that mentions **API** and **web (static …)** if the web build exists.

On the **server**, open another SSH session and test:

```bash
curl -s http://127.0.0.1:4000/health
```

You want `{"ok":true}`.

Stop the test server: go back to the first terminal and press **Ctrl+C**.

---

## 11. Point your domain (DNS) to the server

At the company where you bought **theoove.com** (GoDaddy, Namecheap, Cloudflare, etc.):

1. Open **DNS** settings for the domain.
2. Add an **A** record:
   - **Host / Name:** `@` (or blank — means the root domain)
   - **Value / Points to:** your VPS **IP**
   - **TTL:** 300 or Auto
3. Optional **www** record:
   - **Type:** `CNAME`, **Name:** `www`, **Target:** `theoove.com`  
   - or a second **A** record for `www` → same IP

DNS can take **5 minutes to a few hours** to propagate.

---

## 12. HTTPS with Caddy (easiest free SSL)

On the server:

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy
```

Create `/etc/caddy/Caddyfile` (backup the default first):

```bash
sudo nano /etc/caddy/Caddyfile
```

Put this (replace domain if yours differs):

```text
theoove.com, www.theoove.com {
  reverse_proxy 127.0.0.1:4000
}
```

Reload Caddy:

```bash
sudo systemctl reload caddy
```

Caddy will try to get **Let’s Encrypt** certificates automatically once DNS points to this machine.

---

## 13. Keep the app running after you disconnect (systemd)

```bash
sudo nano /etc/systemd/system/theoove-app.service
```

Paste (adjust paths if your folder is not `/opt/theoove-app`):

```ini
[Unit]
Description=Theoove fintech app (Node + API + static web)
After=network.target postgresql.service

[Service]
Type=simple
User=deploy
WorkingDirectory=/opt/theoove-app
EnvironmentFile=/opt/theoove-app/.env
ExecStart=/usr/bin/node /opt/theoove-app/server/dist/index.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable theoove-app
sudo systemctl start theoove-app
sudo systemctl status theoove-app
```

View logs:

```bash
journalctl -u theoove-app -f
```

---

## 14. Updating after you change code

On your PC: commit and push to Git. On the server:

```bash
cd /opt/theoove-app
git pull
npm ci
npm run build
sudo systemctl restart theoove-app
```

---

## 15. If something fails (short checklist)

| Symptom | Check |
|--------|--------|
| Browser shows **connection refused** | `sudo systemctl status theoove-app` — is it **active**? Is Caddy running? `sudo systemctl status caddy` |
| **502** from Caddy | App not listening: `curl http://127.0.0.1:4000/health` on the server |
| App loads but **login / API errors** | `DATABASE_URL`, `JWT_SECRET`, and **`APP_ORIGIN`** must match your real `https://` URL |
| **Certificate** errors | DNS **A** record must point to this server **before** Caddy requests SSL; wait and reload Caddy |

---

## Files in this repo you can copy

- `deploy/examples/Caddyfile` — same Caddy snippet as above  
- `deploy/examples/theoove-app.service` — same systemd unit as above  
- `.env.example` — list of all optional variables (email, S3, etc.)

You cannot complete **DNS** or **payment for a VPS** from inside the editor; those steps are always yours. Everything from **Section 7** onward can be repeated on any fresh Ubuntu server using this doc.
