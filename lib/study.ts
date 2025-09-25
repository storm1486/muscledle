// lib/study.ts
import muscles from "@/data/muscles.json";

export type Region = "all" | "upper" | "lower";

export type StudyProgress = {
  /** The shuffled deck of slugs to study (filtered by region) */
  order: string[];
  /** Current position in `order` */
  index: number;
  /** Whether we've reached the end of the deck */
  completed: boolean;
  /** Settings that influence which deck is built */
  settings: {
    region: Region;
  };
};

const STORAGE_KEY = "muscledle.study.v2"; // bump key to avoid mixing old data

type MuscleLike = { slug: string; region?: string };

function getSlugsByRegion(region: Region): string[] {
  const list = muscles as unknown as MuscleLike[];
  if (region === "all") return list.map((m) => m.slug);

  const want = region; // "upper" | "lower"
  return list
    .filter((m) => {
      const r = (m.region || "all").toLowerCase();
      return r === want; // include only matching region
    })
    .map((m) => m.slug);
}

/** Fisher–Yates shuffle with seeded PRNG (Mulberry32) */
function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const rand = mulberry32(seed);
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function nowSeed(): number {
  const d = new Date();
  return (
    d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate()
  );
}

function safeLoad(): StudyProgress | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StudyProgress;
    // minimal validation
    if (
      !parsed ||
      !Array.isArray(parsed.order) ||
      typeof parsed.index !== "number" ||
      typeof parsed.completed !== "boolean" ||
      !parsed.settings ||
      (parsed.settings.region !== "all" &&
        parsed.settings.region !== "upper" &&
        parsed.settings.region !== "lower")
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function safeSave(s: StudyProgress): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // ignore quota/availability issues
  }
}

/** Build a fresh shuffled deck for a region */
function buildDeck(region: Region): string[] {
  const slugs = getSlugsByRegion(region);
  const seed = nowSeed();
  return seededShuffle(slugs, seed);
}

/** Create a fresh study plan (defaults to "all"; pass "upper"/"lower" to filter) */
export function resetStudy(region: Region = "all"): StudyProgress {
  const order = buildDeck(region);
  const fresh: StudyProgress = {
    order,
    index: 0,
    completed: order.length === 0,
    settings: { region },
  };
  safeSave(fresh);
  return fresh;
}

/** Load study state (or initialize one if missing) */
export function loadStudy(): StudyProgress {
  const existing = safeLoad();
  if (existing) return existing;
  return resetStudy("all");
}

/** Change the active region and rebuild the deck starting at the first card */
export function setStudyRegion(region: Region): StudyProgress {
  // if the region didn't change, leave current progress as-is
  const cur = loadStudy();
  if (cur.settings.region === region) return cur;

  const order = buildDeck(region);
  const updated: StudyProgress = {
    order,
    index: 0,
    completed: order.length === 0,
    settings: { region },
  };
  safeSave(updated);
  return updated;
}

/** Advance to the next slug; marks completed at the end */
export function advanceStudy(): StudyProgress {
  const cur = loadStudy();
  if (cur.completed) return cur;
  const nextIndex = cur.index + 1;
  const updated: StudyProgress = {
    ...cur,
    index: Math.min(nextIndex, cur.order.length - 1),
    completed: nextIndex >= cur.order.length,
  };
  safeSave(updated);
  return updated;
}

/** Current slug in study flow, or null if none/finished */
export function currentStudySlug(): string | null {
  const cur = loadStudy();
  if (cur.order.length === 0) return null;
  if (cur.completed) return null;
  return cur.order[cur.index] ?? null;
}
