// components/GuessPanel.tsx
"use client";

import React, {
  useEffect,
  useMemo,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";
import muscles from "@/data/muscles.json";

export type Entry = {
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

export type GuessPanelHandle = {
  reveal: () => void; // parent can force reveal
};

function norm(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isMatch(input: string, entry: Entry) {
  const n = norm(input);
  if (!n) return false;
  const pool = new Set(
    [entry.name, entry.slug, ...(entry.accepted || [])].map(norm)
  );
  return pool.has(n);
}

type Props = {
  currentSlug: string | null;
  onCorrect?: (entry: Entry) => void;
  onAttempt?: (result: "correct" | "wrong") => void;
  disabled?: boolean; // NEW
};

const GuessPanel = forwardRef<GuessPanelHandle, Props>(function GuessPanel(
  { currentSlug, onCorrect, onAttempt, disabled = false },
  ref
) {
  const [guess, setGuess] = useState("");
  const [status, setStatus] = useState<
    "idle" | "correct" | "wrong" | "revealed"
  >("idle");

  const entry = useMemo<Entry | undefined>(
    () =>
      currentSlug
        ? (muscles as Entry[]).find((e) => e.slug === currentSlug)
        : undefined,
    [currentSlug]
  );

  useEffect(() => {
    setGuess("");
    setStatus("idle");
  }, [currentSlug]);

  const submit = () => {
    if (!entry) return;

    // ⛔️ Don't process if already correct or revealed
    if (status === "correct" || status === "revealed") return;

    const trimmed = guess.trim();
    if (!trimmed) return;

    if (isMatch(trimmed, entry)) {
      setStatus("correct");
      onAttempt?.("correct");
      onCorrect?.(entry);
    } else {
      setStatus("wrong");
      onAttempt?.("wrong");
    }
  };

  // Allow parent to force “reveal”
  useImperativeHandle(ref, () => ({
    reveal: () => {
      if (!entry) return;
      setStatus((prev) => (prev === "correct" ? "correct" : "revealed"));
    },
  }));

  return (
    <div className="h-full w-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col">
      {/* Header Section */}
      <div className="p-8 border-b border-slate-700/50">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-3 h-3 bg-emerald-400 rounded-full animate-pulse"></div>
          <h2 className="text-2xl font-bold text-white">Muscle Challenge</h2>
        </div>
        <p className="text-slate-400 text-sm">
          Identify the highlighted muscle in the 3D model
        </p>
      </div>
      {/* Main Content */}
      <div className="flex-1 p-8 flex flex-col max-w-lg mx-auto w-full overflow-y-auto min-h-0 justify-start pb-24">
        <div className="space-y-6">
          {/* Input Section */}
          <div className="space-y-4">
            <label className="block text-lg font-medium text-slate-200">
              Your Guess
            </label>
            <div className="relative">
              <input
                className="w-full px-6 py-4 bg-slate-800/50 border border-slate-600/50 rounded-2xl 
           text-white placeholder-slate-400 outline-none transition-all duration-200
           focus:border-emerald-500/50 focus:bg-slate-800/70 focus:ring-2 focus:ring-emerald-500/20
           disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="Type Name of Muscle Displayed"
                value={guess}
                onChange={(e) => setGuess(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault(); // prevent duplicate submits
                    submit();
                  }
                }}
                disabled={
                  disabled ||
                  !entry ||
                  status === "correct" ||
                  status === "revealed"
                }
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
            onClick={submit}
            disabled={
              disabled ||
              !entry ||
              !guess.trim() ||
              status === "correct" ||
              status === "revealed"
            }
            className="w-full px-8 py-4 bg-gradient-to-r from-emerald-600 to-emerald-700 
                     text-white font-semibold rounded-2xl transition-all duration-200
                     hover:from-emerald-500 hover:to-emerald-600 hover:shadow-lg hover:shadow-emerald-500/25
                     disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none
                     transform hover:scale-[1.02] active:scale-[0.98]"
          >
            Submit Answer
          </button>

          {/* Status Messages */}
          <div className="min-h-[60px] flex items-start">
            {status === "wrong" && (
              <div className="w-full p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                <div className="flex items-center gap-2">
                  <span className="text-red-400 text-xl">❌</span>
                  <span className="text-red-300 font-medium">
                    Not quite right — make sure the spelling is correct! 
                  </span>
                </div>
              </div>
            )}

            {(status === "correct" || status === "revealed") && entry && (
              <div className="w-full space-y-4">
                <div
                  className={`p-4 rounded-xl ${
                    status === "correct"
                      ? "bg-emerald-500/10 border border-emerald-500/30"
                      : "bg-slate-700/30 border border-slate-600/50"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {status === "correct" ? (
                      <>
                        <span className="text-emerald-400 text-xl">🎉</span>
                        <span className="text-emerald-300 font-semibold text-lg">
                          Correct! {entry.name}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-slate-200 font-semibold text-lg">
                          Answer: {entry.name}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {entry.oiia && (
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
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

export default GuessPanel;
