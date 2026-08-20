const fs = require("fs");
const path = require("path");

const SOURCE_URL =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json";
const OUTPUT = path.join(__dirname, "..", "src", "data", "exercises.json");

function trimExercises(raw) {
  return raw.map((entry, index) => {
    for (const field of ["id", "name", "category"]) {
      if (typeof entry[field] !== "string" || !entry[field]) {
        throw new Error(`Entry ${index}: missing or invalid "${field}"`);
      }
    }
    if (!Array.isArray(entry.primaryMuscles) || entry.primaryMuscles.length === 0) {
      throw new Error(`Entry ${index} (${entry.name}): empty "primaryMuscles"`);
    }
    if (!Array.isArray(entry.secondaryMuscles)) {
      throw new Error(`Entry ${index} (${entry.name}): missing "secondaryMuscles"`);
    }
    return {
      id: entry.id,
      name: entry.name,
      primaryMuscles: entry.primaryMuscles,
      secondaryMuscles: entry.secondaryMuscles,
      equipment: entry.equipment ?? null,
      category: entry.category,
    };
  });
}

async function main() {
  const response = await fetch(SOURCE_URL);
  if (!response.ok) throw new Error(`Download failed: ${response.status}`);
  const trimmed = trimExercises(await response.json());
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify(trimmed));
  console.log(`Wrote ${trimmed.length} exercises to ${OUTPUT}`);
}

module.exports = { trimExercises };

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
