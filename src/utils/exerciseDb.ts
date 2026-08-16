import { EXERCISES, type CanonicalExercise } from "../data/exercises";

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

export const diceScore = (a: string[], b: string[]): number => {
  const setA = new Set(a);
  const setB = new Set(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let overlap = 0;
  for (const token of setA) if (setB.has(token)) overlap += 1;
  return (2 * overlap) / (setA.size + setB.size);
};

// Dataset names carry qualifier suffixes ("Barbell Bench Press - Medium Grip").
// Scoring against the full name dilutes the overlap so badly that a plain
// "Barbell Bench Press" loses to "Decline Barbell Bench Press".
const baseName = (name: string): string => name.split(" - ")[0];

const tokenIndex = EXERCISES.map((exercise) => ({
  exercise,
  tokens: normalizeTokens(baseName(exercise.name)),
  fullTokens: normalizeTokens(exercise.name),
}));

export interface ExerciseCandidate {
  exercise: CanonicalExercise;
  score: number;
}

export interface MatchResult {
  status: "confident" | "uncertain";
  candidates: ExerciseCandidate[];
}

export const matchExercise = (name: string): MatchResult => {
  const tokens = normalizeTokens(name);
  if (tokens.length === 0) return { status: "uncertain", candidates: [] };

  const scored = tokenIndex
    .map(({ exercise, tokens: dbTokens, fullTokens }) => ({
      exercise,
      score: diceScore(tokens, dbTokens),
      fullScore: diceScore(tokens, fullTokens),
    }))
    .filter((candidate) => candidate.score > 0)
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

const byId = new Map(EXERCISES.map((exercise) => [exercise.id, exercise]));

export const getExerciseById = (id: string): CanonicalExercise | undefined =>
  byId.get(id);
