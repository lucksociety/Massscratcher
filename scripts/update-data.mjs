#!/usr/bin/env node
/**
 * Luck Society Ticket Hunter — daily data updater.
 * Fetches current scratch-game + prizes-remaining data for every configured
 * state and writes data/<state>.json (rotating the previous day into
 * data/<state>-prev.json for the day-over-day indicators).
 *
 * Run by .github/workflows/update-data.yml, or locally: node scripts/update-data.mjs
 * A state that fails validation is skipped WITHOUT touching its data files.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";

const UA = { headers: { "User-Agent": "Mozilla/5.0 (compatible; luck-society-ticket-hunter)", "Accept": "application/json" } };

async function getJSON(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, UA);
      if (!r.ok) throw new Error("HTTP " + r.status);
      return await r.json();
    } catch (e) {
      if (i === tries - 1) throw e;
      await new Promise(res => setTimeout(res, 1500 * (i + 1)));
    }
  }
}

// ---- per-state fetchers: each returns {G, P} in the shared shape ----
const STATES = {
  ma: {
    minGames: 80,
    async fetch() {
      const API = "https://www.masslottery.com/api/v1";
      const games = await getJSON(`${API}/games`);
      const scratch = games.filter(g => g.gameType === "Scratch");
      const G = scratch.map(g => ({
        id: g.id, ident: g.identifier, name: g.name, price: g.price, odds: g.odds,
        start: g.startDate, top: g.topPrize, topDesc: g.topPrizeDescription || null
      }));
      const P = {};
      const queue = [...G];
      let failures = 0;
      await Promise.all(Array.from({ length: 8 }, async () => {
        while (queue.length) {
          const g = queue.shift();
          try {
            const j = await getJSON(`${API}/instant-game-prizes?gameID=${g.id}`);
            P[g.id] = {
              odds: j.odds, cost: j.ticketCost,
              tiers: (j.prizeTiers || []).map(t => [t.prizeAmount, t.totalPrizes, t.paidPrizes, t.prizesRemaining, t.type === "TOP" ? 1 : 0])
            };
          } catch (e) {
            failures++;
            console.error(`  [ma] prize fetch failed for game ${g.id} (${g.name}): ${e.message}`);
          }
        }
      }));
      return { G, P, failures };
    }
  }
  // future states: add an entry here + in the STATES config in index.html
};

await mkdir("data", { recursive: true });
const fetched = new Date().toISOString().slice(0, 10);
let anyFailure = false;

for (const [code, cfg] of Object.entries(STATES)) {
  try {
    const { G, P, failures } = await cfg.fetch();
    if (G.length < cfg.minGames || Object.keys(P).length < G.length * 0.8) {
      throw new Error(`unhealthy fetch: ${G.length} games, ${Object.keys(P).length} prize tables, ${failures} failures`);
    }
    const file = `data/${code}.json`, prevFile = `data/${code}-prev.json`;
    let current = null;
    try { current = JSON.parse(await readFile(file, "utf8")); } catch {}
    if (current && current.fetched && current.fetched !== fetched) {
      await writeFile(prevFile, JSON.stringify(current));
      console.log(`[${code}] rotated ${current.fetched} into ${prevFile}`);
    }
    await writeFile(file, JSON.stringify({ fetched, G, P }));
    console.log(`[${code}] wrote ${file}: ${G.length} games, ${Object.keys(P).length} prize tables, ${failures} failures`);
  } catch (e) {
    anyFailure = true;
    console.error(`[${code}] SKIPPED — ${e.message}`);
  }
}

process.exit(anyFailure ? 1 : 0);
