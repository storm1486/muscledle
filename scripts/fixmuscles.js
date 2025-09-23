// fixRegions.js
import fs from "fs";

function addRegionField(filePath, regionValue = "upper") {
  const raw = fs.readFileSync(filePath, "utf-8");
  const data = JSON.parse(raw);

  const fixed = data.map((m) => ({
    ...m,
    region: m.region ?? regionValue, // add if missing
  }));

  fs.writeFileSync(filePath, JSON.stringify(fixed, null, 2));
  console.log(`✅ Updated ${fixed.length} entries in ${filePath}`);
}

// usage
addRegionField("../src/data/muscles.json", "upper");
