// lib/study.ts
import muscles from "@/data/muscles.json";

export type StudyProgress = {
  order: string[];
  index: number; // 0..order.length-1
  completed: boolean;
};

const KEY = "muscledle/studyProgress/v1";

function shuffle<T>(arr: T[]) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function initStudy(): StudyProgress {
  const order = shuffle((muscles as any[]).map((m) => m.slug as string));
  const prog: StudyProgress = {
    order,
    index: 0,
    completed: order.length === 0,
  };
  if (typeof window !== "undefined")
    localStorage.setItem(KEY, JSON.stringify(prog));
  return prog;
}

export function loadStudy(): StudyProgress {
  if (typeof window === "undefined")
    return { order: [], index: 0, completed: false };
  const raw = localStorage.getItem(KEY);
  if (raw) return JSON.parse(raw) as StudyProgress;
  return initStudy();
}

export function currentStudySlug(): string | null {
  const p = loadStudy();
  if (!p.order.length) return null;
  return p.order[p.index] ?? null;
}

export function advanceStudy(): StudyProgress {
  const p = loadStudy();
  if (p.completed) return p;
  const nextIndex = p.index + 1;
  const completed = nextIndex >= p.order.length;
  const updated: StudyProgress = {
    ...p,
    index: completed ? p.index : nextIndex,
    completed,
  };
  localStorage.setItem(KEY, JSON.stringify(updated));
  return updated;
}

export function resetStudy(): StudyProgress {
  return initStudy();
}
