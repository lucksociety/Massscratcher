#!/usr/bin/env node
/**
 * Fetches current scratch-game + prizes-remaining data from masslottery.com
 * and writes data.json (rotating the previous run into data-prev.json).
 *
 * Run daily by .github/workflows/update-data.yml, or locally: node scripts/update-data.mjs
 * Exits non-zero WITHOUT touching the data files if the fetch looks unhealthy.
 */
import { readFile, writeFile, rename, access } from "node:fs/promises";

const UA = { headers: { "User-Agent": "Mozilla/5.0 (compatible; scratch-edge-finder; +https://github.com)", "Accept": "application/json" } };
const API = "https://www.masslottery.com/api/v1";

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

const games = await getJSON(`${API}/games`);
const scratch = games.filter(g => g.gameType === "Scratch");
if (scratch.length < 80) {
  console.error(`Only ${scratch.length} scratch games returned — refusing to overwrite data.json`);
  process.exit(1);
}

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
      console.error(`prize fetch failed for game ${g.id} (${g.name}): ${e.message}`);
    }
  }
}));

if (Object.keys(P).length < G.length * 0.8) {
  console.error(`Too many prize-fetch failures (${failures}/${G.length}) — refusing to overwrite data.json`);
  process.exit(1);
}

const fetched = new Date().toISOString().slice(0, 10);
const next = JSON.stringify({ fetched, G, P });

// Rotate: keep the previous *day* as data-prev.json for day-over-day deltas.
let current = null;
try { current = JSON.parse(await readFile("data.json", "utf8")); } catch {}
if (current && current.fetched && current.fetched !== fetched) {
  await writeFile("data-prev.json", JSON.stringify(current));
  console.log(`Rotated ${current.fetched} data into data-prev.json`);
}
await writeFile("data.json", next);
console.log(`Wrote data.json: ${G.length} games, ${Object.keys(P).length} prize tables, ${failures} failures, dated ${fetched}`);
