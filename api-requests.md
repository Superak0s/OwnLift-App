# API requests

Server-side endpoint specs for OwnLift-Server. The client already calls these
as specified.

## Persist exerciseId on program exercises

Exercises now carry an optional canonical id from the bundled exercise
database (free-exercise-db). Without server-side persistence it is lost on
every round-trip and users are re-prompted to match on each device.

### POST /api/program/upload

`weeklyPlan.days[].split[person].exercises[]` may now include:

    "exerciseId": "Barbell_Bench_Press"   // optional string, null/absent = custom

Store it alongside name and muscleGroup. Absent or null must be stored as
NULL, not as an empty string — an empty string would falsely read as matched.

### GET /api/program

Return `exerciseId` on every exercise, `null` when unset.

### PATCH /api/program/exercise/add

The `exercise` body object may include `exerciseId`. Same nullability rule.

### PATCH /api/program/exercise/rename

Body may include `newExerciseId` (string or null). When present, overwrite
the stored id — including setting it to NULL, which is how a user converts a
matched exercise back into a custom one.

Status codes unchanged: 200 on success, 400 on a malformed body, 401 when
unauthenticated, 404 when no program is saved.

## person → split rename

The client no longer uses the word "person" anywhere: what used to be a
"person" is a **split** (a named column of a program, e.g. "Me" / "Alex").
Every request below now sends `split` where it used to send `person`. The
client accepts the old `setsByPerson` on read and rewrites it, but it only
ever *sends* the new names.

Recommended server rollout: accept both spellings on input (`split ?? person`,
`setsBySplit ?? setsByPerson`), respond with the new spelling only.

### Program payloads (`POST /api/program/upload`, `GET /api/program`)

In `weeklyPlan.days[].exercises[]`, the sets map is now:

```json
{ "name": "Bench Press", "exerciseId": "...", "muscleGroup": "chest",
  "setsBySplit": { "Me": 4, "Alex": 3 } }
```

`setsByPerson` → `setsBySplit`. `days[].split` (the object keyed by split
name) and the top-level `split: string[]` array are unchanged.

### PATCH /api/program/exercise/rename

Body: `{ dayNumber, split, exerciseIndex, newName, newMuscleGroup?, newExerciseId? }`
— `person` renamed to `split`.

### PATCH /api/program/exercise/add

Body: `{ dayNumber, split, exercise }` — `person` renamed to `split`.

### PATCH /api/program/exercise/sets

Body: `{ dayNumber, split, exerciseIndex, additionalSets }` — `person` renamed
to `split`.

### POST /api/sessions/start

Body: `{ split, dayNumber, dayTitle, muscleGroups, isDemo, startTime }` —
`person` renamed to `split`. The stored session column should follow.

### POST /api/sessions/rename-exercise

Body: `{ split, oldName, newName?, muscleGroup? }` — `person` renamed to `split`.

### GET /api/sessions and GET /api/analytics

Query parameter `person` renamed to `split` (still optional).

### DELETE /api/sessions/person/:person

Path renamed to `DELETE /api/sessions/split/:split`.

Status codes unchanged throughout: 200 on success, 400 on a malformed body,
401 when unauthenticated, 404 when the target does not exist.
