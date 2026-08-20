import { EXERCISES, type CanonicalExercise } from "../data/exercises";
import { EXERCISE_ALIASES } from "./exerciseAliases";
import { perfLog, startTimer, timed } from "./perf";

export type { CanonicalExercise };

export const AUTO_ACCEPT_SCORE = 0.85;
export const SUGGEST_SCORE = 0.5;

const MAX_CANDIDATES = 3;

const ABBREVIATIONS: Record<string, string> = {
  db: "dumbbell",
  bb: "barbell",
  kb: "kettlebell",
  bw: "bodyweight",
  ohp: "overhead press",
  rdl: "romanian deadlift",
  sldl: "stiff leg deadlift",
  gm: "good morning",
  ez: "e z curl bar",
  // The dataset calls plate-loaded machines "Leverage ...", which nobody
  // writes on a program.
  leverage: "machine",
};

// Users write "Tricep Pushdown" where the dataset says "Triceps Pushdown".
// Mangling both sides identically ("press" -> "pres") costs nothing, since
// tokens are only ever compared against other normalized tokens.
const singularize = (token: string): string =>
  token.length > 3 && token.endsWith("s") ? token.slice(0, -1) : token;

export const normalizeTokens = (name: string): string[] =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((token) => (ABBREVIATIONS[token] ?? token).split(" "))
    .map(singularize);

const diceSets = (setA: Set<string>, setB: Set<string>): number => {
  if (setA.size === 0 || setB.size === 0) return 0;
  const [small, large] = setA.size < setB.size ? [setA, setB] : [setB, setA];
  let overlap = 0;
  for (const token of small) if (large.has(token)) overlap += 1;
  return (2 * overlap) / (setA.size + setB.size);
};

export const diceScore = (a: string[], b: string[]): number =>
  diceSets(new Set(a), new Set(b));

// Dataset names carry qualifier suffixes ("Barbell Bench Press - Medium Grip").
// Scoring against the full name dilutes the overlap so badly that a plain
// "Barbell Bench Press" loses to "Decline Barbell Bench Press".
const baseName = (name: string): string => name.split(" - ")[0];

const indexTimer = startTimer();

const tokenIndex = EXERCISES.map((exercise) => ({
  exercise,
  tokens: new Set(normalizeTokens(baseName(exercise.name))),
  fullTokens: new Set(normalizeTokens(exercise.name)),
}));

// Scoring every entry meant ~900 comparisons per name, which stalls the Plan
// screen when a whole program is matched at once. Only entries sharing a token
// can score above zero, and those are the only ones the result keeps.
const postings = new Map<string, number[]>();
tokenIndex.forEach((entry, index) => {
  for (const token of entry.tokens) {
    const bucket = postings.get(token);
    if (bucket) bucket.push(index);
    else postings.set(token, [index]);
  }
});

perfLog("exerciseDb.buildIndex", indexTimer(), `${EXERCISES.length} exercises`);

export interface ExerciseCandidate {
  exercise: CanonicalExercise;
  score: number;
}

export interface MatchResult {
  status: "confident" | "uncertain";
  candidates: ExerciseCandidate[];
}

const byId = new Map(EXERCISES.map((exercise) => [exercise.id, exercise]));

export const getExerciseById = (id: string): CanonicalExercise | undefined =>
  byId.get(id);

const aliasIndex = new Map(
  Object.entries(EXERCISE_ALIASES).map(([alias, id]) => [
    normalizeTokens(alias).join(" "),
    id,
  ]),
);

const computeMatch = (name: string): MatchResult => {
  const tokens = normalizeTokens(name);
  if (tokens.length === 0) return { status: "uncertain", candidates: [] };

  const aliased = aliasIndex.get(tokens.join(" "));
  if (aliased) {
    const exercise = byId.get(aliased);
    if (exercise) {
      return { status: "confident", candidates: [{ exercise, score: 1 }] };
    }
  }

  const queryTokens = new Set(tokens);
  const candidateIndices = new Set<number>();
  for (const token of queryTokens) {
    const bucket = postings.get(token);
    if (bucket) for (const index of bucket) candidateIndices.add(index);
  }

  // Equal scores fall back to the dataset's own order, so restore it before
  // the stable sort.
  const scored = Array.from(candidateIndices)
    .sort((a, b) => a - b)
    .map((index) => {
    const { exercise, tokens: dbTokens, fullTokens } = tokenIndex[index];
    return {
      exercise,
      score: diceSets(queryTokens, dbTokens),
      fullScore: diceSets(queryTokens, fullTokens),
    };
  })
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.fullScore - a.fullScore ||
        a.exercise.name.length - b.exercise.name.length,
    )
    .slice(0, MAX_CANDIDATES);

  const best = scored[0];
  if (!best) return { status: "uncertain", candidates: [] };

  // Stripping qualifiers makes variants collide ("Bench Press - Powerlifting"
  // and "Bench Press - With Bands" both score 1 for "Bench Press"), so a tie at
  // the top is genuinely ambiguous and must be asked about, not guessed at.
  const isSoleWinner = !scored[1] || scored[1].score < best.score;

  // Confidence is gated on the full name, not the qualifier-stripped one:
  // "Squats - With Bands" scores 1 against "Squat" on its base name alone,
  // and auto-accepting it would silently turn a barbell squat into a band one.
  const isConfident =
    best.fullScore >= AUTO_ACCEPT_SCORE &&
    best.score >= AUTO_ACCEPT_SCORE &&
    isSoleWinner;

  const candidates = scored.map(({ exercise, score }) => ({ exercise, score }));

  return {
    status: isConfident ? "confident" : "uncertain",
    candidates: best.score >= SUGGEST_SCORE ? candidates : [],
  };
};

// A program is re-matched on every Plan screen mount, and the same exercise
// name usually repeats across days.
const matchCache = new Map<string, MatchResult>();

export const matchExercise = (name: string): MatchResult => {
  const cached = matchCache.get(name);
  if (cached) return cached;
  const result = timed("exerciseDb.matchExercise", () => computeMatch(name), name);
  matchCache.set(name, result);
  return result;
};

export const searchExercises = (
  query: string,
  limit = 8,
): CanonicalExercise[] => {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [];
  return EXERCISES.filter((exercise) =>
    exercise.name.toLowerCase().includes(trimmed),
  ).slice(0, limit);
};

export interface ExerciseSuggestion {
  id: string;
  label: string;
  meta: string;
}

export const toSuggestions = (
  query: string,
  limit = 8,
): ExerciseSuggestion[] =>
  timed("exerciseDb.searchExercises", () => searchExercises(query, limit), query).map((exercise) => ({
    id: exercise.id,
    label: exercise.name,
    meta: [exercise.primaryMuscles.join(", "), exercise.equipment]
      .filter(Boolean)
      .join(" · "),
  }));

export const MUSCLE_GROUPS: string[] = Array.from(
  new Set(EXERCISES.flatMap((exercise) => exercise.primaryMuscles)),
).sort((a, b) => a.localeCompare(b));

export interface ExerciseFilter {
  query?: string;
  include?: readonly string[];
  exclude?: readonly string[];
  limit?: number;
}

export const filterExercises = ({
  query = "",
  include = [],
  exclude = [],
  limit = 50,
}: ExerciseFilter): CanonicalExercise[] => {
  const needle = query.trim().toLowerCase();
  const results: CanonicalExercise[] = [];
  for (const exercise of EXERCISES) {
    if (needle && !exercise.name.toLowerCase().includes(needle)) continue;
    if (exclude.some((m) => exercise.primaryMuscles.includes(m))) continue;
    if (
      include.length > 0 &&
      !include.some((m) => exercise.primaryMuscles.includes(m))
    )
      continue;
    results.push(exercise);
    if (results.length >= limit) break;
  }
  return results;
};
