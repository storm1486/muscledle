// lib/daily.ts
import muscles from "@/data/muscles.json";

// "YYYY-MM-DD" in a given timezone
function dayKeyInTZ(timeZone = "America/New_York") {
  const d = new Date();
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(d); // en-CA => YYYY-MM-DD
}

// FNV-1a 32-bit
function hash32(s: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function getDailyMuscleSlug(timeZone = "America/New_York") {
  const key = dayKeyInTZ(timeZone);
  const idx = hash32(key) % (muscles as any[]).length;
  return (muscles as any[])[idx].slug as string;
}
