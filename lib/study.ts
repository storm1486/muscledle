// lib/study.ts
import muscles from "@/data/muscles.json";

export type StudyProgress = {
  order: string[]; // array of slugs to study
  index: number; // current position in `order`
  completed: boolean;
};

const STORAGE_KEY = "muscledle.study.v1";

type MuscleLike = { slug: string };

function getAllSlugs(): string[] {
  const list = muscles as unknown as MuscleLike[];
  return list.map((m) => m.slug);
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
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

function nowSeed(): number {
  // reasonably varied but deterministic per app load
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
      typeof parsed.completed !== "boolean"
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

/** Create a fresh study plan (shuffled once) */
export function resetStudy(): StudyProgress {
  const slugs = getAllSlugs();
  const seed = nowSeed();
  const order = seededShuffle(slugs, seed);
  const fresh: StudyProgress = {
    order,
    index: 0,
    completed: order.length === 0,
  };
  safeSave(fresh);
  return fresh;
}

/** Load study state (or initialize one if missing) */
export function loadStudy(): StudyProgress {
  const existing = safeLoad();
  if (existing) return existing;
  return resetStudy();
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
