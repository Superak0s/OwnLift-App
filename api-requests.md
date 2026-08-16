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
