// app/muscle/page.tsx
"use client";

import { useRef, useState, useEffect } from "react";
import MuscleViewer, { MuscleViewerHandle } from "@/components/MuscleViewer";
import GuessPanel, { GuessPanelHandle } from "@/components/GuessPanel";
import { getDailyMuscleSlug } from "../../lib/daily";
import {
  loadStudy,
  resetStudy,
  advanceStudy,
  currentStudySlug,
  setStudyRegion,
  type StudyProgress,
  type Region,
} from "../../lib/study";

type Mode = "daily" | "study" | "free";

// NY-local YYYY-MM-DD
function nyDateKey() {
  const now = new Date();
  // quick-and-clean: use Intl in the client (we're in "use client")
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`; // YYYY-MM-DD
}

// 1) Put this near the top (after constants), to define your fixed lists.
type MissingItem = { muscle: string; reason: string };

const MISSING_BY_REGION: Record<Region, MissingItem[]> = {
  all: [], // auto-filled from upper+lower below in getMissingForRegion
  upper: [
    // EXAMPLES — change these to your real cases or leave empty
    // { muscle: "Subclavius", reason: "model is corrupted in this build" },
  ],
  lower: [
    { muscle: "Gluteus maximus", reason: "model is buggy" },
    // Add more:
    // { muscle: "Gluteus medius", reason: "not exported in current model set" },
    // { muscle: "Piriformis", reason: "UV seam breaks cause render issues" },
  ],
};

function getMissingForRegion(region: Region): MissingItem[] {
  if (region === "all") {
    // Union of upper+lower (deduped by muscle name)
    const map = new Map<string, MissingItem>();
    [...MISSING_BY_REGION.upper, ...MISSING_BY_REGION.lower].forEach((m) =>
      map.set(m.muscle, m),
    );
    return Array.from(map.values());
  }
  return MISSING_BY_REGION[region] ?? [];
}

type Stats = { score: number; attempts: number };

type DailyPersist = {
  date: string;
  slug: string;
  score: number;
  attempts: number;
  completed: boolean;
  solvedOn?: number; // ← ADD
};

const DAILY_KEY = "muscledle.daily.progress";

function loadDaily(): DailyPersist | null {
  try {
    const raw = localStorage.getItem(DAILY_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DailyPersist;
  } catch {
    return null;
  }
}
function saveDaily(d: DailyPersist) {
  try {
    localStorage.setItem(DAILY_KEY, JSON.stringify(d));
  } catch {}
}

export default function MusclePage() {
  const viewerRef = useRef<MuscleViewerHandle>(null);
  const guessRef = useRef<GuessPanelHandle>(null);

  const [mode, setMode] = useState<Mode>("study");
  const [currentSlug, setCurrentSlug] = useState<string | null>(null);

  // separate stats
  const [studyStats, setStudyStats] = useState<Stats>({
    score: 0,
    attempts: 0,
  });
  const [dailyStats, setDailyStats] = useState<DailyPersist | null>(null);

  // Which region the Study deck should use
  const [region, setRegion] = useState<Region>("all");
  // 2) Add these pieces of state inside your component (near other useState hooks).
  const [showMissing, setShowMissing] = useState(true);

  // Re-open the notice whenever the region changes (so users see the right list)
  useEffect(() => {
    setShowMissing(true);
  }, [region]);

  const [study, setStudy] = useState<StudyProgress>({
    order: [],
    index: 0,
    completed: false,
    settings: { region }, // ← required by StudyProgress
  });
  const [freeStats, setFreeStats] = useState<Stats>({ score: 0, attempts: 0 });

  // reveal lock (per muscle display)
  const [canReveal, setCanReveal] = useState(true);

  useEffect(() => {
    if (mode !== "study") return;
    const p = setStudyRegion(region); // rebuild based on region
    setStudy(p);
    const slug = currentStudySlug(); // start at first
    setCurrentSlug(slug);
    if (slug) viewerRef.current?.setBySlug(slug);
    setCanReveal(true);
  }, [region, mode]);

  // reset reveal on slug change
  useEffect(() => {
    setCanReveal(true);
  }, [currentSlug]);

  // ---------- initialize study + daily ----------
  useEffect(() => {
    setStudy(loadStudy());
  }, []);

  // keep your mounted flag
  const [mounted, setMounted] = useState(false);
  // ---------- initialize study + regional settings on mount ----------
  useEffect(() => {
    setMounted(true);

    try {
      const s = loadStudy();
      setStudy(s);
      if (s?.settings?.region) {
        setRegion(s.settings.region);
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 👈 Keep this completely empty so it truly runs ONLY once on startup

  const missingList = mounted ? getMissingForRegion(region) : [];

  useEffect(() => {
    // ensure daily state (for today's date)
    const date = nyDateKey();
    const todaysSlug = getDailyMuscleSlug("America/New_York");
    const existing = loadDaily();

    if (!existing || existing.date !== date || existing.slug !== todaysSlug) {
      const fresh: DailyPersist = {
        date,
        slug: todaysSlug,
        score: 0,
        attempts: 0,
        completed: false,
        solvedOn: undefined, // ← ADD
      };

      setDailyStats(fresh);
      saveDaily(fresh);
    } else {
      setDailyStats(existing);
    }
  }, []);

  // ---------- respond to mode changes ----------
  useEffect(() => {
    if (mode === "daily") {
      // lock viewer to today's daily slug
      const slug = dailyStats?.slug ?? getDailyMuscleSlug("America/New_York");
      setCurrentSlug(slug);
      viewerRef.current?.setBySlug(slug);
    } else if (mode === "study") {
      // Ensure a study deck exists for the current region
      const s = loadStudy();
      if (!s || s.settings.region !== region) {
        setStudyRegion(region);
      }
      const slug = currentStudySlug();
      if (slug) {
        setCurrentSlug(slug);
        viewerRef.current?.setBySlug(slug);
      } else {
        const p = resetStudy(region);
        setStudy(p);
        const s2 = p.order[p.index] ?? null;
        setCurrentSlug(s2);
        if (s2) viewerRef.current?.setBySlug(s2);
      }
    } else {
      // free = random
      viewerRef.current?.next();
    }
  }, [mode, dailyStats?.slug]);

  // --- derived flags ---
  const isAtLastStudyCard =
    mode === "study" &&
    (study.completed ||
      study.order.length === 0 ||
      study.index >= Math.max(0, study.order.length - 1));

  const nextMuscle = () => {
    if (mode === "daily") return; // no skipping

    if (mode === "study") {
      if (isAtLastStudyCard) return; // already at last; do nothing
      const updated = advanceStudy();
      setStudy(updated);
      const slug = currentStudySlug();
      if (slug) {
        setCurrentSlug(slug);
        viewerRef.current?.setBySlug(slug);
      }
      return;
    }

    // free mode
    viewerRef.current?.next();
  };

  // ---- reveal handler (counts as attempt, and locks Daily if used) ----
  const reveal = () => {
    if (!canReveal) return;
    if (mode === "study") {
      setStudyStats((prev) => ({ ...prev, attempts: prev.attempts + 1 }));
    } else if (mode === "daily" && dailyStats) {
      const updated: DailyPersist = {
        ...dailyStats,
        completed: true,
        attempts: dailyStats.attempts + 1,
        // ❌ remove this line:
        // solvedOn: (dailyStats.attempts ?? 0) + 1,
      };
      setDailyStats(updated);
      saveDaily(updated);
    }

    guessRef.current?.reveal();
    setCanReveal(false);
  };

  const handleViewerChange = (_path: string, slug: string) => {
    // keep slug in sync in Free mode
    setCurrentSlug(slug);
  };

  // -------- display numbers depend on mode --------
  const displayScore =
    mode === "study" ? studyStats.score : mode === "free" ? freeStats.score : 0;

  const displayAttempts =
    mode === "study"
      ? studyStats.attempts
      : mode === "free"
        ? freeStats.attempts
        : (dailyStats?.attempts ?? 0);

  // daily lock (can only be done once per day)
  // TIGHTEN daily locking by attempts (6) in your derived flags
  const MAX_DAILY_GUESSES = 6;
  const isDailyLocked =
    mode === "daily" &&
    (!!dailyStats?.completed ||
      (dailyStats?.attempts ?? 0) >= MAX_DAILY_GUESSES);

  useEffect(() => {
    // Show the answer if Daily is finished (solved or max guesses) and we have a slug
    if (
      mode === "daily" &&
      (isDailyLocked || dailyStats?.completed) &&
      currentSlug
    ) {
      guessRef.current?.reveal();
      setCanReveal(false);
    }
  }, [mode, isDailyLocked, dailyStats?.completed, currentSlug]);

  return (
    <div className="flex flex-col w-full min-h-screen md:h-screen bg-slate-900 overflow-x-hidden">
      {/* Header */}
      <header className="w-full bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800 border-b border-slate-700/50 p-4 md:p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center justify-between gap-4 md:gap-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
              Muscle Up
            </h1>
            <p className="text-slate-400 text-xs md:text-sm">
              3D Anatomy Challenge
            </p>
          </div>

          {mounted && mode !== "daily" && (
            <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
              <button
                className={`px-2.5 py-1 rounded-full border text-xs md:text-sm transition-colors ${
                  region === "all"
                    ? "bg-blue-600 text-white border-blue-600"
                    : "border-slate-600 text-slate-300"
                }`}
                onClick={() => setRegion("all")}
                disabled={mode !== "study"}
              >
                All
              </button>
              <button
                className={`px-2.5 py-1 rounded-full border text-xs md:text-sm transition-colors ${
                  region === "upper"
                    ? "bg-blue-600 text-white border-blue-600"
                    : "border-slate-600 text-slate-300"
                }`}
                onClick={() => setRegion("upper")}
                disabled={mode !== "study"}
              >
                Upper Extremity
              </button>
              <button
                className={`px-2.5 py-1 rounded-full border text-xs md:text-sm transition-colors ${
                  region === "lower"
                    ? "bg-blue-600 text-white border-blue-600"
                    : "border-slate-600 text-slate-300"
                }`}
                onClick={() => setRegion("lower")}
                disabled={mode !== "study"}
              >
                Lower Extremity
              </button>
            </div>
          )}

          {/* Mode Switcher */}
          <div className="flex items-center rounded-xl overflow-hidden border border-slate-600/50 shadow-lg bg-slate-800/30 w-full sm:w-auto justify-center sm:justify-start">
            {(["daily", "study", "free"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`
                  flex-1 sm:flex-none px-4 md:px-5 py-2 md:py-2.5 text-xs md:text-sm font-medium transition-all duration-200
                  ${
                    mode === m
                      ? "bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-lg"
                      : "text-slate-300 hover:bg-slate-700/50 hover:text-white"
                  }
                `}
                title={
                  m === "daily"
                    ? "One shared muscle per day"
                    : m === "study"
                      ? "Go through every muscle once"
                      : "Random practice"
                }
              >
                {m === "daily" ? "Daily" : m === "study" ? "Study" : "Free"}
              </button>
            ))}
          </div>

          {/* Stats Section */}
          <div className="flex flex-wrap items-center gap-2 md:gap-3 text-xs md:text-sm w-full lg:w-auto justify-start sm:justify-end">
            {/* Study & Free: Score */}
            {mode !== "daily" && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-2.5 py-1.5 backdrop-blur-sm">
                <span className="text-emerald-300 font-medium">
                  Score: {displayScore}/{displayAttempts}
                </span>
              </div>
            )}

            {/* Study & Free: Accuracy */}
            {mode !== "daily" && displayAttempts > 0 && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg px-2.5 py-1.5 backdrop-blur-sm">
                <span className="text-blue-300 font-medium">
                  {Math.round(
                    (displayScore / Math.max(1, displayAttempts)) * 100,
                  )}
                  % Accuracy
                </span>
              </div>
            )}

            {/* Study-only progress chip */}
            {mode === "study" && mounted && (
              <div className="bg-slate-700/40 border border-slate-600/50 rounded-lg px-2.5 py-1.5 text-slate-200 backdrop-blur-sm">
                {study.completed
                  ? "Study: Completed ✅"
                  : `Study: ${study.index + 1} / ${study.order.length}`}
              </div>
            )}

            {/* Daily-only: Guesses + status */}
            {mode === "daily" && (
              <>
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-2.5 py-1.5 backdrop-blur-sm">
                  <span className="text-amber-200 font-medium">
                    Guesses: {displayAttempts}/{MAX_DAILY_GUESSES}
                  </span>
                </div>

                {typeof dailyStats?.solvedOn === "number" && (
                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-2.5 py-1.5 backdrop-blur-sm">
                    <span className="text-emerald-300 font-medium">
                      Solved on guess #{dailyStats.solvedOn}
                    </span>
                  </div>
                )}

                {dailyStats && (
                  <div
                    className={`rounded-lg px-2.5 py-1.5 border backdrop-blur-sm ${
                      dailyStats.completed
                        ? "bg-amber-500/10 border-amber-500/30 text-amber-200"
                        : "bg-slate-700/40 border-slate-600/50 text-slate-200"
                    }`}
                  >
                    {dailyStats.completed
                      ? "Daily: Done ✅"
                      : "Daily: In progress"}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main split responsive layout */}
      <div className="flex flex-col md:flex-row flex-1 overflow-y-auto md:overflow-hidden">
        {/* Top on Mobile / Left on Desktop = 3D viewer */}
        <div className="w-full md:w-1/2 h-[45vh] md:h-full relative border-b md:border-b-0 md:border-r border-slate-700/30 sticky top-0 md:relative z-10 bg-slate-900 shadow-xl md:shadow-none">
          <MuscleViewer
            ref={viewerRef}
            onChange={handleViewerChange}
            muscleSlug={
              mode === "daily" || mode === "study" ? currentSlug : null
            }
          />
          {/* Legend */}
          <div className="absolute top-3 right-3 md:top-6 md:right-6 bg-black/85 backdrop-blur-md rounded-xl p-3 md:p-4 text-white text-xs md:text-sm shadow-2xl border border-slate-600/30">
            <h3 className="text-[10px] md:text-xs uppercase tracking-wide text-slate-300 mb-1.5 md:mb-3 font-semibold">
              Legend
            </h3>
            <div className="space-y-1.5 md:space-y-2">
              <div className="flex items-center gap-2 md:gap-3">
                <span className="w-2.5 h-2.5 md:w-3 md:h-3 bg-red-500 rounded-full shadow-sm"></span>
                <span>Target Muscle</span>
              </div>
              <div className="flex items-center gap-2 md:gap-3">
                <span className="w-2.5 h-2.5 md:w-3 md:h-3 bg-gray-500/70 rounded-full shadow-sm"></span>
                <span>Skeleton</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom on Mobile / Right on Desktop = GuessPanel */}
        <div className="w-full md:w-1/2 min-h-[55vh] md:h-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col relative z-20">
          {/* Control Bar */}
          <div className="p-4 md:p-6 border-b border-slate-700/50 bg-slate-800/20">
            <div className="flex flex-wrap items-center gap-2 md:gap-3">
              {mode !== "daily" && (
                <button
                  onClick={nextMuscle}
                  disabled={mode === "study" && isAtLastStudyCard}
                  className="flex items-center gap-2 px-4 md:px-5 py-2 md:py-2.5 rounded-xl text-xs md:text-sm font-medium transition-all duration-200
                             bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-500 hover:to-blue-600 hover:shadow-lg hover:shadow-blue-500/25
                             disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none active:scale-95 transform"
                  title={
                    mode === "study" && isAtLastStudyCard
                      ? "End of study deck"
                      : undefined
                  }
                >
                  <span>🔄</span>
                  <span>
                    {mode === "study" ? "Next in Study" : "Next Muscle"}
                  </span>
                </button>
              )}

              <button
                onClick={reveal}
                disabled={!currentSlug || !canReveal || isDailyLocked}
                className="flex items-center gap-2 px-4 md:px-5 py-2 md:py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 
                           text-white rounded-xl text-xs md:text-sm font-medium transition-all duration-200
                           hover:from-amber-500 hover:to-amber-600 hover:shadow-lg hover:shadow-amber-500/25
                           disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none
                           active:scale-95 transform"
                title={
                  isDailyLocked
                    ? "Daily is complete for today"
                    : "Reveal the answer"
                }
              >
                <span>🔍</span>
                <span>Reveal Answer</span>
              </button>

              {mode === "study" && (
                <button
                  onClick={() => {
                    const p = resetStudy(region);
                    setStudy(p);
                    const slug = p.order[p.index] ?? null;
                    setCurrentSlug(slug);
                    if (slug) viewerRef.current?.setBySlug(slug);
                    setStudyStats({ score: 0, attempts: 0 });
                    setCanReveal(true);
                  }}
                  className="ml-auto px-3 md:px-5 py-2 md:py-2.5 rounded-xl border border-slate-600/50 text-slate-200 
                             hover:bg-slate-700/50 hover:border-slate-500 transition-all duration-200
                             active:scale-95 transform font-medium text-xs md:text-sm"
                >
                  Reset Study
                </button>
              )}
            </div>
          </div>

          {/* Missing Muscles Alert */}
          {mode === "study" &&
            mounted &&
            showMissing &&
            missingList.length > 0 && (
              <div className="w-full border-b border-amber-600/30 bg-amber-900/20">
                <div className="px-4 md:px-6 py-3 md:py-4 flex items-start gap-3 md:gap-4">
                  <div className="text-amber-300 text-lg md:text-xl leading-none">
                    ⚠️
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-amber-200 text-xs md:text-sm font-semibold">
                      Some{" "}
                      {region === "all"
                        ? "muscles"
                        : `${region} extremity muscles`}{" "}
                      aren’t available
                    </h2>
                    <p className="text-amber-200/90 text-[11px] md:text-xs mt-0.5">
                      The following muscles aren’t shown in the 3D viewer due to
                      known model issues:
                    </p>

                    <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {missingList.map((m) => (
                        <li
                          key={m.muscle}
                          className="rounded-lg border border-amber-700/40 bg-amber-800/20 px-2 py-1 text-amber-100 text-[11px] md:text-xs"
                        >
                          <span className="font-medium">{m.muscle}</span>
                          <span className="opacity-80"> — {m.reason}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    onClick={() => setShowMissing(false)}
                    className="ml-2 rounded-md border border-amber-700/40 px-1.5 py-0.5 text-amber-200 text-[10px] md:text-xs hover:bg-amber-800/30 transition-colors shrink-0"
                    aria-label="Dismiss missing muscles notice"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

          {/* GuessPanel container panel */}
          <div className="flex-1 p-2 md:p-0">
            <GuessPanel
              ref={guessRef}
              currentSlug={currentSlug}
              disabled={isDailyLocked}
              hintLevel={mode === "daily" ? (dailyStats?.attempts ?? 0) : 0}
              onCorrect={() => {
                if (mode === "study") {
                  setStudyStats((prev) => ({ ...prev, score: prev.score + 1 }));
                } else if (mode === "free") {
                  setFreeStats((prev) => ({ ...prev, score: prev.score + 1 }));
                } else if (mode === "daily" && dailyStats) {
                  const updated: DailyPersist = {
                    ...dailyStats,
                    completed: true,
                    solvedOn: (dailyStats.attempts ?? 0) + 1,
                  };
                  setDailyStats(updated);
                  saveDaily(updated);
                }
                setCanReveal(false);
              }}
              onAttempt={() => {
                if (mode === "study") {
                  setStudyStats((prev) => ({
                    ...prev,
                    attempts: prev.attempts + 1,
                  }));
                } else if (mode === "free") {
                  setFreeStats((prev) => ({
                    ...prev,
                    attempts: prev.attempts + 1,
                  }));
                } else if (mode === "daily" && dailyStats) {
                  const newAttempts = dailyStats.attempts + 1;
                  const updated: DailyPersist = {
                    ...dailyStats,
                    attempts: newAttempts,
                    completed:
                      newAttempts >= MAX_DAILY_GUESSES
                        ? true
                        : dailyStats.completed,
                  };
                  setDailyStats(updated);
                  saveDaily(updated);

                  if (newAttempts >= MAX_DAILY_GUESSES) {
                    guessRef.current?.reveal();
                    setCanReveal(false);
                  }
                }
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
