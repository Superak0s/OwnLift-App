# Tracking Feature — API Endpoint Audit

Audits every HTTP call made by `OwnLift-App/src/features/tracking/` against the routes actually mounted in `OwnLift-Server`. Only `services/on/*` modules make HTTP calls (server mode); `services/off/*` are local-SQLite equivalents and `services/index.tsx` dispatches between them via `createDispatchProxy` based on app mode. `tracking/context/TrackingModalsContext.tsx` makes no direct API calls.

Base client: `OwnLift-App/src/shared/services/config.tsx` (base URL), `authenticatedFetch.tsx` (auth header, timeout), `apiClient.ts` (`apiCall()` wrapper). Server mount table: `OwnLift-Server/routes.ts:34-45`, all under `/api/tracking/*`.

## ❌ MISSING on server

### `progressPhoto` module — entire module has no backend (`services/on/progressPhoto.ts`)

The server only mounts `/api/tracking/photos` (see `bodyStats` below); nothing is mounted at `/api/tracking/progress-photos`. Zero hits for `"progress-photos"` anywhere in `OwnLift-Server`.

| Method + Path | Frontend def | Call sites |
|---|---|---|
| `POST /api/tracking/progress-photos` (`uploadPhoto`) | `services/on/progressPhoto.ts:18` | `components/LogProgressPhotoModal.tsx:182-183` |
| `GET /api/tracking/progress-photos?limit=` (`getAllPhotos`) | `services/on/progressPhoto.ts:28` | `tabs/PhotosTab.tsx:109,341,491` |
| `GET /api/tracking/progress-photos/muscle/:muscle` (`getPhotosByMuscle`) | `services/on/progressPhoto.ts:35` | `components/MuscleDashboard.tsx:62` |
| `GET /api/tracking/progress-photos/range?start=&end=` (`getPhotosInRange`) | `services/on/progressPhoto.ts:42` | unused in UI |
| `DELETE /api/tracking/progress-photos/:id` (`deletePhoto`) | `services/on/progressPhoto.ts:49` | unused in UI |

**Impact:** live 404s from `LogProgressPhotoModal`, `PhotosTab`, and `MuscleDashboard` in server mode. This is separate from the working `bodyTrackingApi` photo endpoints (`/api/tracking/photos`) used elsewhere.

### `soreness` module — one dead route

| Method + Path | Frontend def | Call sites | Server |
|---|---|---|---|
| `GET /api/tracking/soreness/map` (`getSorenessMap`) | `services/on/soreness.ts:35` | unused in UI | `soreness.routes.ts` only defines `POST /`, `GET /`, `DELETE /:id` (lines 18-64) — no `/map` route anywhere |

Low urgency (not called from UI) but a stale contract worth deleting or implementing.

## ⚠️ Wrong-endpoint wiring bug (not missing, but breaks at runtime)

`hooks/useTrackingModals.ts` wires three "delete from day modal" callbacks to the wrong API function — all three point at `bodyTrackingApi.deleteWeightEntry` (`DELETE /api/tracking/bodystats/weight/:id`) instead of their own type's delete endpoint. The target endpoints all exist server-side, so this isn't a missing-route issue — it's a copy-paste bug that will delete/attempt-to-delete the wrong record (or silently no-op) when invoked from that modal.

| Line | Should call | Currently calls |
|---|---|---|
| `hooks/useTrackingModals.ts:362` | `bodyMeasurementsApi.deleteMeasurementEntry` | `bodyTrackingApi.deleteWeightEntry` |
| `hooks/useTrackingModals.ts:366` | `hydrationApi.deleteHydrationEntry` | `bodyTrackingApi.deleteWeightEntry` |
| `hooks/useTrackingModals.ts:370` | `sorenessApi.deleteSorenessEntry` | `bodyTrackingApi.deleteWeightEntry` |

## ✅ Everything else — exists server-side

| Module | Endpoints | Server routes file |
|---|---|---|
| bodyStats (weight, bodyfat, photos) | 8 endpoints, all present | `OwnLift-Server/features/tracking/bodyStats/bodyStats.routes.ts`, `.../photos/photos.routes.ts` |
| bodyMeasurements | 3 endpoints, all present | `.../bodyMeasurements/bodyMeasurements.routes.ts` |
| customMeasurements | 6 endpoints, all present (3 unused in UI: `deleteType`, `getValuesForDate`, `getValuesForType`) | `.../customMeasurements/customMeasurements.routes.ts` |
| doms | 6 endpoints, all present | `.../doms/doms.routes.ts` |
| hydration | 5 endpoints, all present | `.../hydration/hydration.routes.ts` |
| injury | 4 endpoints, all present | `.../injury/injury.routes.ts` |
| macros | 4 endpoints, all present | `.../macros/macros.routes.ts` |
| menstrual | 8 endpoints, all present | `.../menstrual/menstrual.routes.ts` |
| personalNotes | 2 endpoints, all present | `.../personalNotes/personalNotes.routes.ts` |
| soreness | `POST /`, `GET /`, `DELETE /:id` present; `GET /map` missing (see above) | `.../soreness/soreness.routes.ts` |

## Summary

- **6 missing routes**: 5 for `progressPhoto` (module has zero backend, 3 of which are actively called and will 404), 1 for `soreness/map` (dead, unused).
- **3 wrong-wiring bugs** in `useTrackingModals.ts` that hit real-but-wrong endpoints.
- **5 defined-but-unused-in-UI** endpoints (`customMeasurements` x3, `soreness.logSoreness`, `progressPhoto.getPhotosInRange`/`deletePhoto`).
