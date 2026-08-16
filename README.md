# Luck Society Ticket Hunter

The best scratch tickets to buy **today**, ranked from the lottery's own daily prizes-claimed / prizes-remaining data. Currently covering **Massachusetts**; built to add more states.

**Fresh data, three layers deep** — the page always shows the freshest numbers it can get:

1. On page load it shows `data/ma.json` (refreshed daily by a GitHub Action).
2. In the background it fetches the lottery's API directly from the visitor's browser (MassLottery's API allows cross-origin requests) and upgrades the page to live numbers.
3. If both fail, a snapshot embedded in `index.html` still renders.

`data/ma-prev.json` (yesterday's data) powers the day-over-day movement arrows and NEW-game tags.

## Deploying on GitHub Pages

1. Create a GitHub repository and push these files to the `main` branch.
2. **Settings → Pages** → under *Build and deployment*, set Source to **Deploy from a branch**, branch `main`, folder `/ (root)`. Save.
3. **Actions tab** → **Update lottery data** → **Run workflow** once, manually, to pull today's data. (If the push fails, check **Settings → Actions → General → Workflow permissions** → *Read and write permissions*.)
4. The site is live at `https://<username>.github.io/<repo>/`, and the workflow re-pulls fresh data every morning at 10:30 UTC (~6:30am ET), committing only when the numbers changed.

## Files

| File | Purpose |
|---|---|
| `index.html` | The entire dashboard — brand, metrics, charts (single file, no build step) |
| `data/ma.json` | Massachusetts data, written daily by the workflow |
| `data/ma-prev.json` | Previous day's data, for movement indicators (appears after day 2) |
| `scripts/update-data.mjs` | Node 20+ fetcher, one entry per state (no npm packages) |
| `.github/workflows/update-data.yml` | Daily schedule + manual trigger |

## Adding a state

1. Find the state lottery's scratch-game data source (game list + per-game prize tiers with claimed/remaining counts).
2. Add a fetcher entry in `scripts/update-data.mjs` returning the shared `{G, P}` shape (`G`: id/ident/name/price/odds/start/top; `P[id]`: odds/cost/tiers `[amount, total, paid, remaining, isTop]`).
3. Add a matching entry in the `STATES` config at the top of `index.html` (names, data paths, game-page URL builder, and — if the API allows CORS — a live fetcher).
4. The state appears in the site's state selector via `?state=<code>`.

## How the ranking works

Lotteries publish claimed/remaining counts per prize tier, but not tickets remaining. Ticket Hunter estimates tickets sold from the claim rate of the high-count small-prize tiers (claimed almost instantly, so their claim rate tracks sales), then computes:

- **Value per $** — unclaimed prize dollars per remaining ticket, per $1 of ticket price
- **Win chance** — remaining winning tickets vs. estimated remaining tickets
- **Jackpot hunt** — top prizes remaining relative to the game's original design
- **Best overall** — 55% value + 25% win chance + 20% jackpot (percentile-blended)

Games ≥95% sold are flagged: their estimates get noisy, and a listed top prize may already be on its way to being claimed.

---

A Luck Society project. Not affiliated with any state lottery. Scratch tickets are entertainment with a negative average return — if gambling stops being fun, call 1-800-327-5050 (MA Problem Gambling Helpline).
