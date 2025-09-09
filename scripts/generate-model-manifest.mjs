// scripts/generate-model-manifest.mjs
import { promises as fs } from "fs";
import path from "path";

const MODELS_DIR = path.join(process.cwd(), "public", "models");

async function run() {
  const entries = await fs.readdir(MODELS_DIR, { withFileTypes: true });
  const files = entries
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".glb"))
    .map((e) => `/models/${e.name}`) // public assets are served from site root
    .sort((a, b) => a.localeCompare(b));
  const outPath = path.join(MODELS_DIR, "manifest.json");
  await fs.writeFile(outPath, JSON.stringify(files, null, 2));
  console.log(`Wrote ${files.length} entries to ${outPath}`);
}
run().catch((err) => {
  console.error(err);
  process.exit(1);
});
