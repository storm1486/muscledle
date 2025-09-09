// app/muscle/page.tsx
"use client";

import { useRef, useState, useMemo, useEffect } from "react";
import MuscleViewer, { MuscleViewerHandle } from "@/components/MuscleViewer";
// Put your metadata file here (the one with slug/name/accepted/oiia)
import muscles from "@/data/muscles.json"; // adjust path if you put it elsewhere

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

// --- tiny helpers for matching ---
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

  // what the viewer is currently showing
  const [currentSlug, setCurrentSlug] = useState<string | null>(null);

  // guess UI state
  const [guess, setGuess] = useState("");
  const [status, setStatus] = useState<"idle" | "correct" | "wrong">("idle");
  const [score, setScore] = useState(0);
  const [attempts, setAttempts] = useState(0);

  // find metadata for current slug (or fall back to a generated name)
  const entry: MuscleMeta | undefined = useMemo(() => {
    if (!currentSlug) return undefined;
    const found = (muscles as MuscleMeta[]).find((m) => m.slug === currentSlug);
    if (found) return found;

    // Fallback entry so the game still works even if metadata is missing.
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

  // reset guess state when the model changes
  useEffect(() => {
    setGuess("");
    setStatus("idle");
  }, [currentSlug]);

  const submitGuess = () => {
    if (!entry) return;

    setAttempts((prev) => prev + 1);

    if (isMatch(guess, entry)) {
      setStatus("correct");
      setScore((prev) => prev + 1);
    } else {
      setStatus("wrong");
    }
  };

  const reveal = () => {
    setStatus("correct");
    setAttempts((prev) => prev + 1);
  };

  const nextMuscle = () => {
    viewerRef.current?.next();
  };

  return (
    <div className="flex flex-col w-full h-screen bg-slate-900">
      {/* Enhanced Header */}
      <header className="w-full bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800 border-b border-slate-700/50 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-2xl font-bold text-white">Muscledle</h1>
                <p className="text-slate-400 text-sm">3D Anatomy Challenge</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            {/* Score Display */}
            <div className="flex items-center gap-4 text-sm">
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2">
                <span className="text-emerald-300 font-medium">
                  Score: {score}/{attempts}
                </span>
              </div>
              {attempts > 0 && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg px-3 py-2">
                  <span className="text-blue-300 font-medium">
                    {Math.round((score / attempts) * 100)}% Accuracy
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main content area: split into two halves */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left half = 3D viewer */}
        <div className="w-1/2 h-full relative">
          <MuscleViewer
            ref={viewerRef}
            onChange={(_path, slug) => {
              setCurrentSlug(slug);
            }}
          />

          {/* Viewer Overlay Controls */}
          <div className="absolute top-4 right-4 flex flex-col gap-2">
            <div className="bg-black/70 backdrop-blur-sm rounded-lg p-2 text-white text-xs">
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
        </div>

        {/* Right half = Enhanced Guess UI */}
        <div className="w-1/2 h-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col">
          {/* Control Bar */}
          <div className="p-6 border-b border-slate-700/50">
            <div className="flex items-center gap-3">
              <button
                onClick={nextMuscle}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 
                         text-white rounded-xl hover:from-blue-500 hover:to-blue-600 transition-all duration-200
                         transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-blue-500/25"
              >
                <span>🔄</span>
                Next Muscle
              </button>

              <button
                onClick={reveal}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-700 
                         text-white rounded-xl hover:from-amber-500 hover:to-amber-600 transition-all duration-200
                         transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-amber-500/25
                         disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
                disabled={!entry || status === "correct"}
              >
                <span>🔍</span>
                Reveal Answer
              </button>

              {status === "correct" && (
                <div className="ml-auto flex items-center gap-2 text-emerald-400">
                  <span className="animate-pulse">✅</span>
                  <span className="font-medium">Correct!</span>
                </div>
              )}
            </div>
          </div>

          {/* Main Guess Panel */}
          <div className="flex-1 flex flex-col justify-center max-w-lg mx-auto w-full px-8">
            <div className="space-y-6">
              {/* Input Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-emerald-400 rounded-full animate-pulse"></div>
                  <label className="block text-xl font-bold text-white">
                    Identify the Muscle
                  </label>
                </div>

                <div className="relative">
                  <input
                    className="w-full px-6 py-4 bg-slate-800/50 border border-slate-600/50 rounded-2xl 
                             text-white placeholder-slate-400 outline-none transition-all duration-200
                             focus:border-emerald-500/50 focus:bg-slate-800/70 focus:ring-2 focus:ring-emerald-500/20
                             disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="e.g., Pectoralis major, Biceps, Quadriceps..."
                    value={guess}
                    onChange={(e) => setGuess(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submitGuess()}
                    disabled={!entry || status === "correct"}
                  />
                  {guess && status !== "correct" && (
                    <button
                      onClick={() => setGuess("")}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white
                               transition-colors duration-200"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Submit Button */}
              <button
                onClick={submitGuess}
                disabled={!entry || !guess.trim() || status === "correct"}
                className="w-full px-8 py-4 bg-gradient-to-r from-emerald-600 to-emerald-700 
                         text-white font-semibold rounded-2xl transition-all duration-200
                         hover:from-emerald-500 hover:to-emerald-600 hover:shadow-lg hover:shadow-emerald-500/25
                         disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none
                         transform hover:scale-[1.02] active:scale-[0.98]"
              >
                Submit Answer
              </button>

              {/* Status Messages */}
              <div className="min-h-[100px]">
                {status === "wrong" && (
                  <div className="w-full p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                    <div className="flex items-center gap-2">
                      <span className="text-red-400 text-xl">❌</span>
                      <span className="text-red-300 font-medium">
                        Not quite right — try again!
                      </span>
                    </div>
                  </div>
                )}

                {status === "correct" && entry && (
                  <div className="w-full space-y-4">
                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-emerald-400 text-xl">🎉</span>
                        <span className="text-emerald-300 font-semibold text-lg">
                          Correct! {entry.name}
                        </span>
                      </div>
                    </div>

                    {entry.oiia ? (
                      <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6 space-y-4">
                        <h3 className="text-white font-semibold text-lg mb-3 flex items-center gap-2">
                          <span className="text-blue-400">📚</span>
                          Anatomical Details
                        </h3>
                        <div className="grid gap-4">
                          {[
                            {
                              label: "Origin",
                              value: entry.oiia.origin,
                              icon: "🔸",
                            },
                            {
                              label: "Insertion",
                              value: entry.oiia.insertion,
                              icon: "🔹",
                            },
                            {
                              label: "Innervation",
                              value: entry.oiia.innervation,
                              icon: "⚡",
                            },
                            {
                              label: "Action",
                              value: entry.oiia.action,
                              icon: "💪",
                            },
                          ].map(({ label, value, icon }) => (
                            <div key={label} className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span>{icon}</span>
                                <span className="text-slate-300 font-medium">
                                  {label}:
                                </span>
                              </div>
                              <p className="text-slate-200 text-sm leading-relaxed pl-6">
                                {value}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4">
                        <div className="flex items-start gap-2">
                          <span className="text-yellow-400">⚠️</span>
                          <div className="text-slate-300 text-sm">
                            <p className="font-medium mb-1">
                              No anatomical data available
                            </p>
                            <p className="text-slate-400 text-xs">
                              Add OIIA metadata in{" "}
                              <code className="bg-slate-700/50 px-1 py-0.5 rounded">
                                /data/muscles.json
                              </code>{" "}
                              under slug{" "}
                              <code className="bg-slate-700/50 px-1 py-0.5 rounded">
                                {entry.slug}
                              </code>
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer Tip */}
          <div className="p-6 border-t border-slate-700/50">
            <div className="bg-slate-800/30 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <span className="text-blue-400 text-sm">💡</span>
                <div className="text-slate-400 text-xs leading-relaxed">
                  <p className="mb-1">
                    <strong className="text-slate-300">Pro tip:</strong> Common
                    abbreviations and synonyms are accepted (e.g., "pec major",
                    "traps", "lats", "quads").
                  </p>
                  <p className="text-slate-500">
                    Configure accepted terms in{" "}
                    <code className="bg-slate-700/50 px-1 rounded">
                      /data/muscles.json
                    </code>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
