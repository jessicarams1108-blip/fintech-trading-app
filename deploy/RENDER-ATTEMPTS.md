# Render deploy attempts

| Attempt | Date | Result | Notes |
|---------|------|--------|-------|
| 1 | | | Blueprint or manual — see `RENDER-NOW.md` |
| 2 | | | Manual web service only if attempt 1 failed |

**Rule:** If both fail, tell the assistant: **`Render failed twice`** → remove Railway/Render from repo and begin Vercel-only plan (`deploy/VERCEL-ONLY-FALLBACK.md`).
