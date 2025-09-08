import MuscleViewer from "@/components/MuscleViewer";

export default function MusclePage() {
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
          <MuscleViewer />
        </div>

        {/* Right half = reserved for UI / empty */}
        <div className="w-1/2 h-full bg-black-50 flex items-center justify-center">
          <p className="text-gray-600">Right side content goes here</p>
        </div>
      </div>
    </div>
  );
}
