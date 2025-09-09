// app/muscle/page.tsx (example)
"use client";
import { useRef } from "react";
import MuscleViewer, { MuscleViewerHandle } from "@/components/MuscleViewer";

export default function MusclePage() {
  const viewerRef = useRef<MuscleViewerHandle>(null);

  return (
    <div className="flex flex-col w-full h-screen">
      {/* Header */}
      <header className="w-full bg-gray-800 text-white p-4">
        <h1 className="text-xl font-bold">Muscledle</h1>
      </header>

      {/* Main content area: split into two halves */}
      <div className="flex flex-1">
        {/* Left half = 3D viewer */}
        <div className="w-1/2 h-full">
          <MuscleViewer ref={viewerRef} />
        </div>

        {/* Right half = UI column */}
        <div className="w-1/2 h-full flex flex-col bg-gray-50">
          {/* Top bar with button */}
          <div className="p-4 border-b border-gray-200">
            <button
              onClick={() => viewerRef.current?.next()}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Next Muscle
            </button>
          </div>

          {/* Rest of the panel */}
          <div className="flex-1 flex items-center justify-center">
            <p className="text-gray-600">Right side content goes here</p>
          </div>
        </div>
      </div>
    </div>
  );
}
