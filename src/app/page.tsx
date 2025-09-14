// app/muscle/page.tsx
"use client";

import { useRef, useState, useMemo, useEffect } from "react";
import MuscleViewer, { MuscleViewerHandle } from "@/components/MuscleViewer";
import GuessPanel, { GuessPanelHandle } from "@/components/GuessPanel";
import muscles from "@/data/muscles.json";
import { getDailyMuscleSlug } from "../../lib/daily";
import {
  loadStudy,
  resetStudy,
  advanceStudy,
  currentStudySlug,
  type StudyProgress,
} from "../../lib/study";

type Mode = "daily" | "study" | "free";

type MuscleMeta = {
  slug: string;
  name: string;
  accepted: string[];
  oiia?: {
    origin: string;
    insertion: string;
    innervation: string;
    action: string;
  };
};

function norm(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
function isMatch(input: string, entry: MuscleMeta) {
  const n = norm(input);
  if (!n) return false;
  const pool = new Set(
    [entry.name, entry.slug, ...(entry.accepted || [])].map(norm)
  );
  return pool.has(n);
}

export default function MusclePage() {
  const viewerRef = useRef<MuscleViewerHandle>(null);
  const guessRef = useRef<GuessPanelHandle>(null);

  const [mode, setMode] = useState<Mode>("daily");
  const [currentSlug, setCurrentSlug] = useState<string | null>(null);

  const [score, setScore] = useState(0);
  const [attempts, setAttempts] = useState(0);

  const [study, setStudy] = useState<StudyProgress>(() => loadStudy());

  // top-level state
  const [canReveal, setCanReveal] = useState(true);

  // reset reveal availability when the muscle changes
  useEffect(() => {
    setCanReveal(true);
  }, [currentSlug]);

  const entry: MuscleMeta | undefined = useMemo(() => {
    if (!currentSlug) return undefined;
    const found = (muscles as MuscleMeta[]).find((m) => m.slug === currentSlug);
    if (found) return found;
    const prettyName = currentSlug
      .split("-")
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(" ");
    return {
      slug: currentSlug,
      name: prettyName,
      accepted: [currentSlug, prettyName],
    };
  }, [currentSlug]);

  // when mode changes, lock the viewer to the correct slug
  useEffect(() => {
    if (mode === "daily") {
      const slug = getDailyMuscleSlug("America/New_York");
      setCurrentSlug(slug);
      viewerRef.current?.setBySlug(slug);
    } else if (mode === "study") {
      const slug = currentStudySlug();
      if (slug) {
        setCurrentSlug(slug);
        viewerRef.current?.setBySlug(slug);
      } else {
        const p = resetStudy();
        setStudy(p);
        const s2 = p.order[p.index] ?? null;
        setCurrentSlug(s2);
        if (s2) viewerRef.current?.setBySlug(s2);
      }
    } else {
      viewerRef.current?.next(); // free/random
    }
  }, [mode]);

  useEffect(() => setStudy(loadStudy()), []);

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

  const reveal = () => {
    if (!canReveal) return; // block repeat reveal on same muscle
    setAttempts((a) => a + 1); // count reveal as an attempt
    guessRef.current?.reveal(); // show the answer in the panel
    setCanReveal(false); // lock reveal for this muscle
  };

  const handleViewerChange = (_path: string, slug: string) => {
    // keep slug synced in Free mode (or when randomizing)
    setCurrentSlug(slug);
  };

  return (
    <div className="flex flex-col w-full h-screen bg-slate-900">
      {/* Header */}
      <header className="w-full bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800 border-b border-slate-700/50 p-6">
        <div className="flex items-center justify-between gap-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Muscle Up</h1>
            <p className="text-slate-400 text-sm">3D Anatomy Challenge</p>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center rounded-xl overflow-hidden border border-slate-700/50">
            {(["daily", "study", "free"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={[
                  "px-4 py-2 text-sm",
                  mode === m
                    ? "bg-slate-700 text-white"
                    : "text-slate-300 hover:bg-slate-800",
                ].join(" ")}
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

          {/* Score + Study progress */}
          <div className="flex items-center gap-4 text-sm">
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2">
              <span className="text-emerald-300 font-medium">
                Score: {score}/{attempts}
              </span>
            </div>
            {attempts > 0 && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg px-3 py-2">
                <span className="text-blue-300 font-medium">
                  {Math.round((score / Math.max(1, attempts)) * 100)}% Accuracy
                </span>
              </div>
            )}
            {mode === "study" && (
              <div className="bg-slate-700/40 border border-slate-600/50 rounded-lg px-3 py-2 text-slate-200">
                {study.completed
                  ? "Study: Completed"
                  : `Study: ${study.index + 1} / ${study.order.length}`}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main split */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left = 3D viewer */}
        <div className="w-1/2 h-full relative">
          <MuscleViewer
            ref={viewerRef}
            onChange={handleViewerChange}
            muscleSlug={
              mode === "daily" || mode === "study" ? currentSlug : null
            }
          />
          {/* Legend */}
          <div className="absolute top-4 right-4 bg-black/70 backdrop-blur-sm rounded-lg p-2 text-white text-xs">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 bg-red-500 rounded-full"></span>
              <span>Target Muscle</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-gray-500 rounded-full"></span>
              <span>Skeleton</span>
            </div>
          </div>
        </div>

        {/* Right = GuessPanel */}
        <div className="w-1/2 h-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col">
          {/* Control Bar */}
          <div className="p-6 border-b border-slate-700/50">
            <div className="flex items-center gap-3">
              {mode !== "daily" && (
                <button
                  onClick={nextMuscle}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 
                   text-white rounded-xl ..."
                >
                  <span>🔄</span>
                  {mode === "study" ? "Next in Study" : "Next Muscle"}
                </button>
              )}

              <button
                onClick={reveal}
                disabled={!currentSlug || !canReveal}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-700 
                 text-white rounded-xl disabled:opacity-50 ..."
              >
                <span>🔍</span>
                Reveal Answer
              </button>

              {mode === "study" && (
                <button
                  onClick={() => {
                    const p = resetStudy();
                    setStudy(p);
                    const slug = p.order[p.index] ?? null;
                    setCurrentSlug(slug);
                    if (slug) viewerRef.current?.setBySlug(slug);
                    setScore(0);
                    setAttempts(0);
                    setCanReveal(true);
                  }}
                  className="ml-auto px-4 py-2 rounded-xl border border-slate-600 text-slate-200 hover:bg-slate-800"
                >
                  Reset Study
                </button>
              )}
            </div>
          </div>

          {/* GuessPanel drives UI + OIIA */}
          <GuessPanel
            ref={guessRef}
            currentSlug={currentSlug}
            onCorrect={() => {
              setScore((s) => s + 1);
              setCanReveal(false); // prevent reveal after correct

              if (mode === "study") {
                const updated = advanceStudy();
                setStudy(updated);
                const slug = currentStudySlug();
                if (slug) {
                  setCurrentSlug(slug);
                  viewerRef.current?.setBySlug(slug);
                }
              }
            }}
            onAttempt={() => {
              setAttempts((a) => a + 1);
            }}
          />
        </div>
      </div>
    </div>
  );
}
