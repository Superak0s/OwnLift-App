# Exercise Database

Replace free-text exercise names with a bundled canonical exercise database
(free-exercise-db), matched on import and selected directly everywhere else.

## Problem

Exercises are free-text strings today. `src/utils/exerciseMatching.tsx` fuzzy-matches
a name against the other names already in the user's own plan, and `muscleGroup` is a
free-text field validated against a hand-maintained `CANONICAL_MUSCLE_GROUPS` list.

Three consequences:

- The same lift entered twice with different spellings is two different exercises.
- Muscle data is whatever the user typed, so nothing downstream can rely on it.
- Swap suggestions can only offer exercises already in the plan.

## Scope

In scope:

- Bundled, build-time-generated exercise dataset.
- A canonical `exerciseId` on plan exercises.
- Import matching, prompting the user only when the match is uncertain.
- Primary and secondary muscles sourced from the dataset.
- A shared exercise picker replacing free-text entry in the Plan and Workout screens.
- Lazy migration of existing plans.

Out of scope, deliberately:

- Exercise images. Not used at all.
- Exercise instructions. Stripped from the bundle.
- A browsable exercise library or detail screen.
- Muscle-group volume analytics.
- Upgrading swap suggestions to query the dataset.

The last three become small follow-ups once `exerciseId` and structured muscles exist.

## The dataset

`scripts/build-exercise-db.js` reads a checkout of free-exercise-db and writes
`src/data/exercises.json`, which is committed. The script keeps only:

```ts
interface CanonicalExercise {
  id: string;
  name: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  equipment: string | null;
  category: string;
}
```

Dropping images and instructions takes roughly 870 exercises from ~1.5 MB to ~100 KB,
small enough to `require()` into memory at startup and treat as a plain array.

The script must assert the upstream shape (required keys present, muscle and equipment
values drawn from the expected vocabularies) and fail loudly rather than silently
emitting a half-empty dataset if upstream renames a field.

There is no SQLite table and no seeding step. For 870 static rows, a schema version,
a re-seed path and FTS5 would all be machinery with nothing to do; a linear filter over
870 objects is sub-millisecond per keystroke. Updating the dataset means rerunning the
script and committing the result.

## Data model

`exerciseId` is added alongside the existing `name`, which is preserved as the user's
own label:

```ts
// @shared/types
export interface Exercise {
  name: string;
  exerciseId?: string;   // canonical id; absent means custom
  muscleGroup?: string;  // fallback for exercises with no exerciseId
  sets: number;
}
```

The same optional field is added to `ExerciseWithSets` and to `ExerciseDraft` in
`src/features/plan/types.ts`.

Muscles are **looked up through `exerciseId` at read time, never copied onto the plan**.
Denormalizing them creates stale data the first time the dataset is regenerated.
`muscleGroup` remains the fallback for unmatched exercises, so `CANONICAL_MUSCLE_GROUPS`
and `checkMuscleGroupForTypo` stay as they are.

**Exercises with no match stay first-class.** A user's own accessory movement keeps
working with `exerciseId` absent. Nothing in the flow forces a match.

Logged sets are not changed. `RecordSetSyncData` carries `exerciseName`, and a set's
exercise can be resolved back to an `exerciseId` through the plan when needed — cheaper
than a second server-side schema change for a consumer that does not exist yet.

## Matching

A new `src/utils/exerciseDb.ts` owns dataset access and matching. `exerciseMatching.tsx`
keeps its existing responsibilities (typo checks against plan-local names, muscle group
canonicalization) and is not deleted.

Raw Levenshtein is the wrong primary signal here: "DB Incline Press" and "Incline
Dumbbell Bench Press" are the same lift but score poorly on edit distance. Scoring is:

1. **Normalize** — lowercase, strip punctuation, expand gym abbreviations
   (`db` → dumbbell, `bb` → barbell, `ohp` → overhead press, `rdl` → romanian deadlift).
2. **Score** — Dice coefficient over the token sets as the primary signal, with the
   existing `calculateSimilarity` as a tiebreaker between near-equal candidates.

Thresholds:

| Score | Behaviour |
|-------|-----------|
| ≥ 0.85 | Accept automatically |
| 0.5 – 0.85 | Ask the user: top 3 candidates plus "none of these" |
| < 0.5 | Ask the user, defaulting to a search box rather than suggestions |

Anything the user answers "none of these" to is kept as a custom exercise.

This is the single non-trivial algorithm in the feature and gets a unit test alongside
`exerciseMatching.test.ts`, covering: an exact match, an abbreviation expansion that only
Dice resolves, a genuinely ambiguous pair that must land in the ask band, and a nonsense
name that must not auto-accept.

## Flows

**Import.** After parsing a program, match every exercise. Confident matches are applied
silently. Everything in an ask band is collected into **one review screen** listing only
the uncertain exercises — not a modal per exercise. The screen offers the candidates, a
search box, and "keep as custom".

**Entry.** A shared `ExercisePicker` component — search over the dataset, filters for
muscle and equipment, and a "use a custom name" escape hatch — replaces free-text entry
in `src/features/plan/components/ExerciseEditBlock.tsx` and in the Workout screen's
add-exercise flow. New exercises therefore get an `exerciseId` at creation, which is what
stops the free-text problem from recurring.

**Migration.** `exerciseId` is optional, so existing plans keep working untouched. When a
plan is next opened, exercises missing an ID are matched: confident ones are filled in
silently, uncertain ones raise a single dismissible "review N exercises" prompt leading to
the same review screen. No startup migration pass, nothing blocking, works offline.

## App-mode split

The dataset and matcher are local, pure, and identical in both modes, so they live in
`src/utils/` and `src/shared/`, with no `on/`/`off/` service pair.

Only persistence differs, and it already does: offline plans round-trip through
`sqliteStorage` and will carry `exerciseId` for free, while online plans need the server
change below.

## Server change

`/api/program/exercise/rename`, `/add` and `/sets` imply the server parses the plan into
rows rather than storing the uploaded blob verbatim, so an unknown `exerciseId` field
would be dropped on round-trip and matching would be lost on every device switch.

The exact endpoint spec — persisting `exerciseId` on program upload, returning it on
fetch, and accepting it on exercise add — is written to `api-requests.md` for
implementation in OwnLift-Server. Client code calls the endpoints as if the field is
already supported.

## Testing

- Unit tests for normalization and match scoring, per the table above.
- A test asserting the build script rejects a dataset with a missing required field.
- Existing `exerciseMatching.test.ts` must continue to pass unchanged.

## Risks

- **Upstream drift.** free-exercise-db could change field names. Mitigated by the
  script's schema assertion.
- **Match quality.** The thresholds are a first calibration and will need tuning against
  real imported programs. They belong in named constants, not inline literals.
- **Server lag.** Until the server change ships, online-mode plans lose `exerciseId` on
  round-trip and re-prompt. The lazy migration makes this degrade to a repeated prompt
  rather than data loss.
