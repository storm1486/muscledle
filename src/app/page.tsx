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
      map.set(m.muscle, m)
    );
    return Array.from(map.values());
  }
  return MISSING_BY_REGION[region] ?? [];
}

type Stats = { score: number; attempts: number };

type DailyPersist = {
  date: string; // YYYY-MM-DD (NY)
  slug: string; // daily slug chosen
  score: number;
  attempts: number;
  completed: boolean; // lock flag
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
  useEffect(() => setMounted(true), []);

  // NEW: after mount, load the real region from localStorage-backed study
  useEffect(() => {
    try {
      const s = loadStudy();
      if (s?.settings?.region) {
        setRegion(s.settings.region);
      }
    } catch {
      // ignore
    }
  }, []);
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

  const nextMuscle = () => {
    if (mode === "daily") return; // no skipping
    if (mode === "study") {
      const updated = advanceStudy();
      setStudy(updated);
      const slug = currentStudySlug();
      if (slug) {
        setCurrentSlug(slug);
        viewerRef.current?.setBySlug(slug);
      }
      return;
    }
    viewerRef.current?.next();
  };

  // ---- reveal handler (counts as attempt, and locks Daily if used) ----
  const reveal = () => {
    if (!canReveal) return;
    // Count attempt into current mode's stats
    if (mode === "study") {
      setStudyStats((prev) => ({ ...prev, attempts: prev.attempts + 1 }));
    } else if (mode === "daily" && dailyStats) {
      const updated: DailyPersist = {
        ...dailyStats,
        attempts: dailyStats.attempts + 1,
        completed: true, // using reveal finishes daily for today
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
    mode === "study"
      ? studyStats.score
      : mode === "daily"
      ? dailyStats?.score ?? 0
      : 0;
  const displayAttempts =
    mode === "study"
      ? studyStats.attempts
      : mode === "daily"
      ? dailyStats?.attempts ?? 0
      : 0;

  // daily lock (can only be done once per day)
  const isDailyLocked = mode === "daily" && !!dailyStats?.completed;

  return (
    <div className="flex flex-col w-full h-screen bg-slate-900">
      {/* Header */}
      <header className="w-full bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800 border-b border-slate-700/50 p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold text-white bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
              Muscle Up
            </h1>
            <p className="text-slate-400 text-sm">3D Anatomy Challenge</p>
          </div>
          {mounted && (
            <div className="flex items-center gap-2">
              <button
                className={`px-3 py-1 rounded-full border text-sm ${
                  region === "all"
                    ? "bg-blue-600 text-white border-blue-600"
                    : "border-gray-300"
                }`}
                onClick={() => setRegion("all")}
                disabled={mode !== "study"}
              >
                All
              </button>
              <button
                className={`px-3 py-1 rounded-full border text-sm ${
                  region === "upper"
                    ? "bg-blue-600 text-white border-blue-600"
                    : "border-gray-300"
                }`}
                onClick={() => setRegion("upper")}
                disabled={mode !== "study"}
              >
                Upper Extremity
              </button>
              <button
                className={`px-3 py-1 rounded-full border text-sm ${
                  region === "lower"
                    ? "bg-blue-600 text-white border-blue-600"
                    : "border-gray-300"
                }`}
                onClick={() => setRegion("lower")}
                disabled={mode !== "study"}
              >
                Lower Extremity
              </button>
            </div>
          )}

          {/* Mode Switcher */}
          <div className="flex items-center rounded-xl overflow-hidden border border-slate-600/50 shadow-lg bg-slate-800/30">
            {(["study", "free"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`
                  px-5 py-2.5 text-sm font-medium transition-all duration-200
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
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2 backdrop-blur-sm">
              <span className="text-emerald-300 font-medium">
                Score: {displayScore}/{displayAttempts}
              </span>
            </div>
            {displayAttempts > 0 && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg px-3 py-2 backdrop-blur-sm">
                <span className="text-blue-300 font-medium">
                  {Math.round(
                    (displayScore / Math.max(1, displayAttempts)) * 100
                  )}
                  % Accuracy
                </span>
              </div>
            )}
            {mode === "study" && mounted && (
              <div className="bg-slate-700/40 border border-slate-600/50 rounded-lg px-3 py-2 text-slate-200 backdrop-blur-sm">
                {study.completed
                  ? "Study: Completed ✅"
                  : `Study: ${study.index + 1} / ${study.order.length}`}
              </div>
            )}

            {mode === "daily" && dailyStats && (
              <div
                className={`rounded-lg px-3 py-2 border backdrop-blur-sm ${
                  dailyStats.completed
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-200"
                    : "bg-slate-700/40 border-slate-600/50 text-slate-200"
                }`}
              >
                {dailyStats.completed
                  ? "Daily: Done for today ✅"
                  : "Daily: In progress"}
              </div>
            )}
          </div>
        </div>
      </header>
      {/* Main split */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left = 3D viewer */}
        <div className="w-1/2 h-full relative border-r border-slate-700/30">
          <MuscleViewer
            ref={viewerRef}
            onChange={handleViewerChange}
            muscleSlug={
              mode === "daily" || mode === "study" ? currentSlug : null
            }
          />
          {/* Legend - Enhanced styling */}
          <div className="absolute top-6 right-6 bg-black/80 backdrop-blur-md rounded-xl p-4 text-white text-sm shadow-2xl border border-slate-600/30">
            <h3 className="text-xs uppercase tracking-wide text-slate-300 mb-3 font-semibold">
              Legend
            </h3>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-red-500 rounded-full shadow-sm"></span>
                <span>Target Muscle</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-gray-500/70 rounded-full shadow-sm"></span>
                <span>Skeleton</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right = GuessPanel */}
        <div className="w-1/2 h-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col">
          {/* Control Bar - Enhanced styling */}
          <div className="p-6 border-b border-slate-700/50 bg-slate-800/20">
            <div className="flex flex-wrap items-center gap-3">
              {mode !== "daily" && (
                <button
                  onClick={nextMuscle}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 
                           text-white rounded-xl font-medium transition-all duration-200
                           hover:from-blue-500 hover:to-blue-600 hover:shadow-lg hover:shadow-blue-500/25
                           active:scale-95 transform"
                >
                  <span>🔄</span>
                  {mode === "study" ? "Next in Study" : "Next Muscle"}
                </button>
              )}

              <button
                onClick={reveal}
                disabled={!currentSlug || !canReveal || isDailyLocked}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 
                         text-white rounded-xl font-medium transition-all duration-200
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
                Reveal Answer
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
                  className="ml-auto px-5 py-2.5 rounded-xl border border-slate-600/50 text-slate-200 
                           hover:bg-slate-700/50 hover:border-slate-500 transition-all duration-200
                           active:scale-95 transform font-medium"
                >
                  Reset Study
                </button>
              )}
            </div>
          </div>

          {mode === "study" &&
            mounted &&
            showMissing &&
            missingList.length > 0 && (
              <div className="w-full border-b border-amber-600/30 bg-amber-900/20">
                <div className="mx-auto max-w-6xl px-6 py-4 flex items-start gap-4">
                  <div className="text-amber-300 text-xl leading-none">⚠️</div>
                  <div className="flex-1">
                    <h2 className="text-amber-200 font-semibold">
                      Some{" "}
                      {region === "all"
                        ? "muscles"
                        : `${region} extremity muscles`}{" "}
                      aren’t available
                    </h2>
                    <p className="text-amber-200/90 text-sm mt-1">
                      The following muscles aren’t shown in the 3D viewer due to
                      known model issues:
                    </p>

                    <ul className="mt-3 grid sm:grid-cols-2 gap-2">
                      {missingList.map((m) => (
                        <li
                          key={m.muscle}
                          className="rounded-lg border border-amber-700/40 bg-amber-800/20 px-3 py-2 text-amber-100 text-sm"
                        >
                          <span className="font-medium">{m.muscle}</span>
                          <span className="opacity-80"> — {m.reason}</span>
                        </li>
                      ))}
                    </ul>

                    <p className="text-amber-200/80 text-xs mt-3">
                      We’ll include them once the models are fixed.
                    </p>
                  </div>

                  <button
                    onClick={() => setShowMissing(false)}
                    className="ml-2 rounded-md border border-amber-700/40 px-2 py-1 text-amber-200 text-xs hover:bg-amber-800/30"
                    aria-label="Dismiss missing muscles notice"
                    title="Dismiss"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

          {/* GuessPanel drives UI + OIIA */}
          <GuessPanel
            ref={guessRef}
            currentSlug={currentSlug}
            disabled={isDailyLocked} // ← block inputs when daily is done
            onCorrect={() => {
              if (mode === "study") {
                setStudyStats((prev) => ({ ...prev, score: prev.score + 1 }));
              } else if (mode === "daily" && dailyStats) {
                const updated: DailyPersist = {
                  ...dailyStats,
                  score: dailyStats.score + 1,
                  completed: true, // correct guess finishes daily
                };
                setDailyStats(updated);
                saveDaily(updated);
              }
              setCanReveal(false); // prevent reveal after correct
            }}
            onAttempt={() => {
              if (mode === "study") {
                setStudyStats((prev) => ({
                  ...prev,
                  attempts: prev.attempts + 1,
                }));
              } else if (mode === "daily" && dailyStats) {
                const updated: DailyPersist = {
                  ...dailyStats,
                  attempts: dailyStats.attempts + 1,
                };
                setDailyStats(updated);
                saveDaily(updated);
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}
