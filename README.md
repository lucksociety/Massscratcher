# MA Scratch Ticket Edge Finder

A static dashboard that ranks every Massachusetts Lottery scratch game by which gives you the best shot **today**, computed from MassLottery's own daily prizes-claimed / prizes-remaining data.

**Live data, three layers deep** — the page always shows the freshest numbers it can get:

1. When a visitor opens the page, it immediately shows `data.json` (refreshed daily by a GitHub Action).
2. In the background it fetches masslottery.com's API directly from the visitor's browser (the API allows cross-origin requests) and upgrades the page to live numbers.
3. If both fail, a snapshot embedded in `index.html` still renders.

`data-prev.json` (yesterday's data) powers the day-over-day movement arrows and NEW-game tags.

## Deploying on GitHub Pages

1. Create a new GitHub repository and push these files to the `main` branch.
2. **Settings → Pages** → under *Build and deployment*, set Source to **Deploy from a branch**, branch `main`, folder `/ (root)`. Save.
3. **Actions tab** → select **Update lottery data** → **Run workflow** once, manually. This fetches today's data and commits `data.json`. (If Actions asks for permission the first time, enable workflows for the repo. The workflow already requests `contents: write`, but if the push fails check **Settings → Actions → General → Workflow permissions** and select *Read and write permissions*.)
4. Done. The site is at `https://<username>.github.io/<repo>/` and the workflow re-pulls fresh data every morning at 10:30 UTC (~6:30am ET), committing only when the numbers actually changed.

## Files

| File | Purpose |
|---|---|
| `index.html` | The entire dashboard (single file, no build step, no dependencies) |
| `data.json` | Today's raw data, written daily by the workflow |
| `data-prev.json` | The previous day's data, for movement indicators |
| `scripts/update-data.mjs` | Node 20+ fetcher (no npm packages needed) |
| `.github/workflows/update-data.yml` | Daily schedule + manual trigger |

## How the ranking works

MassLottery publishes claimed/remaining counts per prize tier, but not tickets remaining. The dashboard estimates tickets sold from the claim rate of the high-count small-prize tiers (those are claimed almost instantly, so their claim rate tracks sales), then computes:

- **Value per $** — unclaimed prize dollars per remaining ticket, per $1 of ticket price
- **Win chance** — remaining winning tickets vs. estimated remaining tickets
- **Jackpot hunt** — top prizes remaining relative to the game's original design
- **Best overall** — 55% value + 25% win chance + 20% jackpot (percentile-blended)

Games ≥95% sold are flagged: their estimates get noisy, and a listed top prize may already be on its way to being claimed.

Data source: `masslottery.com/api/v1/games` and `masslottery.com/api/v1/instant-game-prizes?gameID={id}`. This project is not affiliated with the Massachusetts State Lottery. Scratch tickets are entertainment with a negative average return — if gambling stops being fun, call 1-800-327-5050 (MA Problem Gambling Helpline).
