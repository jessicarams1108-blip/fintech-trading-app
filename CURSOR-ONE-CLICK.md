# Preview in Cursor (one action — no `.cmd` file)

You are paying for the agent to **write and wire code**. Starting a long‑running server **on your PC** must still run **inside your environment** — Cursor sometimes blocks the agent from launching background servers automatically (Windows sandbox). Here is the **simplest in‑editor** way.

## One-time setup

1. In Cursor: **File → Open Folder…**
2. Choose the folder **`fintech-trading-app`** (the one that contains `web` and `package.json` at the root).

## Every time you want to preview

1. **Terminal → Run Task…** (or press **Ctrl+Shift+B** — we set this as the default build task).
2. Pick **“Preview website (Vite)”**.
3. Wait until the terminal shows **`Local: http://localhost:5173/`**.
4. Open in browser: **http://localhost:5173/** (opens Quick Links)

Leave the task terminal **open** while you preview. **Ctrl+Shift+B** again only if you stopped the server.

---

If **Run Task** is missing or fails, use **Terminal → New Terminal** and run:

`npm run dev -w web`

Same folder: `fintech-trading-app`.
