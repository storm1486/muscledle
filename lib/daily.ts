// lib/daily.ts
import muscles from "@/data/muscles.json";

type MuscleLike = { slug: string };

/** YYYY-MM-DD in a given IANA timezone (e.g., "America/New_York") */
function dateKey(tz: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Simple deterministic int from a date key string */
function hashDateKey(key: string): number {
  // 32-bit FNV-1a
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Return today's daily muscle slug in the provided timezone. */
export function getDailyMuscleSlug(tz: string): string {
  const list = muscles as unknown as MuscleLike[];
  if (!Array.isArray(list) || list.length === 0) {
    // Fallback so page doesn't crash; you can throw instead if you prefer.
    return "unknown";
  }
  const today = dateKey(tz);
  const h = hashDateKey(today);
  const idx = h % list.length;
  return list[idx].slug;
}
