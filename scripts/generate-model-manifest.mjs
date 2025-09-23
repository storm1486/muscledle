// scripts/generate-model-manifest.mjs
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve project root (.. from /scripts) and target directory
const rootDir = path.resolve(__dirname, "..");
const MODELS_DIR = path.join(rootDir, "public", "models");

async function run() {
  console.log("Scanning models in:", MODELS_DIR);

  // Ensure the directory exists (nice error if it doesn't)
  try {
    const stat = await fs.stat(MODELS_DIR);
    if (!stat.isDirectory()) {
      throw new Error(`Expected a directory at ${MODELS_DIR}, found a file.`);
    }
  } catch (err) {
    if (err.code === "ENOENT") {
      throw new Error(
        `Models directory not found at ${MODELS_DIR}.\n` +
          `Make sure your .glb files live in /public/models relative to the project root.`
      );
    }
    throw err;
  }

  const entries = await fs.readdir(MODELS_DIR, { withFileTypes: true });

  const files = entries
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".glb"))
    // public assets are served from site root at /models/*
    .map((e) => `/models/${e.name}`)
    .sort((a, b) => a.localeCompare(b));

  const outPath = path.join(MODELS_DIR, "manifest.json");
  await fs.writeFile(outPath, JSON.stringify(files, null, 2));
  console.log(`Wrote ${files.length} entries to ${outPath}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
