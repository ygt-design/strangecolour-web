#!/usr/bin/env node
/**
 * Creates N random → project channels on Are.na (same block layout as the CMS
 * "Submit a new project"): Image (remote URL) + Client, Size, Scope, Architect, Year,
 * then connects each channel to Page / Past and Page / Project List.
 *
 * Run from strangecolor-web (loads .env next to package.json):
 *   node scripts/seed-random-arena-projects.mjs
 *   COUNT=10 node scripts/seed-random-arena-projects.mjs
 *
 * Standalone → channels only (no link to Past / Project List):
 *   SKIP_CONNECT=1 node scripts/seed-random-arena-projects.mjs
 *
 * Env (same as Vite):
 *   VITE_ARENA_API_KEY or ARENA_API_KEY
 *   VITE_GROUP_SLUG or GROUP_SLUG
 *
 * Optional: node --env-file=.env scripts/seed-random-arena-projects.mjs (Node 20.6+)
 */

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = join(__dirname, "..");

function loadDotenv() {
  const path = join(WEB_ROOT, ".env");
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadDotenv();

const BASE_URL = "https://api.are.na/v3";
const COUNT = Math.max(1, Math.min(100, Number(process.env.COUNT) || 30));
const DELAY_MS = Math.max(0, Number(process.env.SEED_DELAY_MS) || 400);
const SKIP_CONNECT =
  process.env.SKIP_CONNECT === "1" || process.env.SKIP_CONNECT === "true";

const TOKEN = process.env.ARENA_API_KEY || process.env.VITE_ARENA_API_KEY;
const GROUP_SLUG = process.env.GROUP_SLUG || process.env.VITE_GROUP_SLUG;

const ADJECTIVES = [
  "Quiet",
  "Dense",
  "Soft",
  "Sharp",
  "Warm",
  "Cool",
  "Raw",
  "Fine",
  "Bold",
  "Thin",
  "Deep",
  "Flat",
  "Bright",
  "Muted",
  "Rapid",
  "Slow",
  "Twin",
  "Single",
  "Outer",
  "Inner",
];
const NOUNS = [
  "Pavilion",
  "Bench",
  "Facade",
  "Court",
  "Tower",
  "Bridge",
  "Studio",
  "Archive",
  "Garden",
  "Lobby",
  "Atrium",
  "Shelter",
  "Frame",
  "Volume",
  "Mesh",
  "Grid",
  "Canopy",
  "Plinth",
  "Core",
];
const SCOPES = [
  "Interior fit-out",
  "Full renovation",
  "New build",
  "Feasibility study",
  "Competition",
  "Masterplan",
  "Landscape",
  "Furniture",
  "Lighting study",
  "Facade concept",
];
const CLIENTS = [
  "Private",
  "Municipal trust",
  "Arts foundation",
  "Developer consortium",
  "University",
  "Gallery board",
  "Family office",
  "Cooperative",
  "Hotel group",
  "Tech campus",
];
const ARCHITECTS = [
  "Studio North",
  "Atelier Flux",
  "Office of Parts",
  "Parallel Works",
  "Field Office",
  "Common Room",
  "Layered Practice",
  "Open Yard",
  "Soft Grid",
  "Dense Air",
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomYear() {
  const lo = 1998;
  const hi = new Date().getFullYear();
  return String(lo + Math.floor(Math.random() * (hi - lo + 1)));
}

function randomSize() {
  const sqm = 40 + Math.floor(Math.random() * 8000);
  return `${sqm.toLocaleString()} sqm`;
}

function randomProjectName(index) {
  const a = pick(ADJECTIVES);
  const n = pick(NOUNS);
  const salt = Math.random().toString(36).slice(2, 6);
  return `${a} ${n} (${salt}) #${index + 1}`;
}

function randomImageUrl(seed) {
  return `https://picsum.photos/seed/${seed}/960/720?grayscale`;
}

function normalizeProjectTitle(name) {
  let trimmed = String(name ?? "")
    .trim()
    .replace(/^→\s*/, "")
    .trim();
  if (!trimmed) throw new Error("Project name is required");
  return `→ ${trimmed}`;
}

async function parseArenaError(res) {
  const jsonBody = await res.json().catch(() => null);
  const textBody = jsonBody ? null : await res.text().catch(() => null);
  const msg =
    jsonBody?.details?.message ||
    jsonBody?.error ||
    textBody ||
    res.statusText ||
    "Unknown error";
  const err = new Error(`Arena API ${res.status}: ${msg}`);
  err.status = res.status;
  err.body = jsonBody ?? textBody ?? null;
  throw err;
}

async function arena(path, { method = "GET", body, token } = {}) {
  const headers = { Authorization: `Bearer ${token}` };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 304) return null;
  if (!res.ok) await parseArenaError(res);
  if (res.status === 204) return null;
  return res.json().catch(() => null);
}

async function getGroup(slug, token) {
  return arena(`/groups/${encodeURIComponent(slug)}`, { token });
}

async function fetchAllGroupChannels(slug, token) {
  let page = 1;
  const per = 100;
  const all = [];
  while (true) {
    const res = await arena(
      `/groups/${encodeURIComponent(slug)}/contents?type=Channel&page=${page}&per=${per}`,
      { token },
    );
    const data = res?.data ?? [];
    all.push(...data);
    if (!res?.meta?.has_more_pages) break;
    page += 1;
  }
  return all;
}

function findChannelByTitle(channels, title) {
  const t = title.toLowerCase();
  return channels.find((ch) => ch.title?.toLowerCase() === t) ?? null;
}

async function createProjectChannel({
  title,
  imageUrl,
  client,
  size,
  scope,
  architect,
  year,
  groupId,
  pagePastId,
  pageProjectListId,
  token,
  connectParents,
}) {
  const channel = await arena("/channels", {
    method: "POST",
    token,
    body: {
      title,
      visibility: "closed",
      group_id: groupId,
    },
  });
  const channelId = channel?.id;
  if (!channelId) throw new Error("Created channel is missing an id");

  await arena("/blocks", {
    method: "POST",
    token,
    body: {
      value: imageUrl.trim(),
      title: "Image",
      channel_ids: [channelId],
    },
  });

  for (const [blockTitle, content] of [
    ["Client", client],
    ["Size", size],
    ["Scope", scope],
    ["Architect", architect],
    ["Year", year],
  ]) {
    await arena("/blocks", {
      method: "POST",
      token,
      body: {
        value: content.trim(),
        title: blockTitle,
        channel_ids: [channelId],
      },
    });
  }

  if (connectParents) {
    await arena("/connections", {
      method: "POST",
      token,
      body: {
        connectable_id: channelId,
        connectable_type: "Channel",
        channel_ids: [pagePastId, pageProjectListId],
      },
    });
  }

  return channel;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  if (!TOKEN) {
    console.error(
      "Missing API token. Set ARENA_API_KEY or VITE_ARENA_API_KEY (e.g. in .env).",
    );
    process.exit(1);
  }
  if (!GROUP_SLUG) {
    console.error(
      "Missing group slug. Set GROUP_SLUG or VITE_GROUP_SLUG (e.g. in .env).",
    );
    process.exit(1);
  }

  console.log(`Group: ${GROUP_SLUG} · Creating ${COUNT} → projects…`);

  const group = await getGroup(GROUP_SLUG, TOKEN);
  if (!group?.id) {
    console.error(`Group "${GROUP_SLUG}" not found or has no id.`);
    process.exit(1);
  }

  let pagePast = null;
  let pageProjectList = null;
  if (!SKIP_CONNECT) {
    const channels = await fetchAllGroupChannels(GROUP_SLUG, TOKEN);
    pagePast = findChannelByTitle(channels, "Page / Past");
    pageProjectList = findChannelByTitle(channels, "Page / Project List");
    if (!pagePast?.id) {
      console.error('Could not find channel "Page / Past" in this group.');
      process.exit(1);
    }
    if (!pageProjectList?.id) {
      console.error(
        'Could not find channel "Page / Project List" in this group.',
      );
      process.exit(1);
    }
  } else {
    console.log(
      "SKIP_CONNECT=1 — channels will not be added to Past / Project List.",
    );
  }

  const baseSeed = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  for (let i = 0; i < COUNT; i += 1) {
    const title = normalizeProjectTitle(randomProjectName(i));
    const imageUrl = randomImageUrl(`${baseSeed}-${i}`);

    try {
      const ch = await createProjectChannel({
        title,
        imageUrl,
        client: pick(CLIENTS),
        size: randomSize(),
        scope: pick(SCOPES),
        architect: pick(ARCHITECTS),
        year: randomYear(),
        groupId: group.id,
        pagePastId: pagePast?.id,
        pageProjectListId: pageProjectList?.id,
        token: TOKEN,
        connectParents: !SKIP_CONNECT,
      });
      console.log(
        `  [${i + 1}/${COUNT}] OK — ${ch?.title ?? title} (id ${ch?.id})`,
      );
    } catch (e) {
      console.error(
        `  [${i + 1}/${COUNT}] FAIL — ${title}: ${e?.message ?? e}`,
      );
    }

    if (DELAY_MS > 0 && i < COUNT - 1) await sleep(DELAY_MS);
  }

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
