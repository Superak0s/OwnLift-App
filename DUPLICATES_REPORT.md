# Duplicate Code Report

Generated: 2026-08-02

---

## 🔴 HIGH PRIORITY — Actual Duplicates / Dead Code

### 1. `generateWidgetId` Duplicates `generateId` Logic

**Problem:** `generateWidgetId` in `useWidgets.tsx` reimplements the same ID generation pattern already provided by `generateId()` in `format.tsx`.

| Location | Function | Issue |
|---|---|---|
| `src/utils/format.tsx` | `generateId(prefix?)` | ✅ Single source — generates unique IDs with optional prefix |
| `src/shared/context/hooks/useWidgets.tsx` | `generateWidgetId()` | ❌ Inline duplicate — uses same `Math.random().toString(36)` pattern |

**Fix:** Replace `generateWidgetId()` with a call to `generateId("widget")` from `utils/format.tsx`.

---

### 2. Deprecated Type Aliases Still Present

**Problem:** Old aliases in `supplements/types.ts` are marked deprecated but still exist in the codebase.

| Location | Type | Issue |
|---|---|---|
| `src/features/supplements/types.ts` | `SelectedLocation` | ❌ Deprecated alias for `ReminderLocation` — still exported |
| `src/features/supplements/types.ts` | `SupplementLocationParams` | ❌ Deprecated alias for `ReminderLocation` — still exported |
| `src/shared/types.ts` | `ReminderLocation` | ✅ Canonical definition |

**Fix:** Remove deprecated aliases and update any imports to use `ReminderLocation` directly.

---

### 3. `SetDetail` vs `SetDetails` Naming Inconsistency

**Problem:** The same type is imported under different names (singular vs plural) in different files.

| Location | Name Used | Issue |
|---|---|---|
| `src/shared/types.ts` | `SetDetail` | ✅ Original definition (singular) |
| `src/features/workout/types.ts` | `SetDetails` | ⚠️ Imported as plural alias |
| `src/utils/dayCompletion.tsx` | `SetDetails` | ⚠️ Imported as plural alias |

**Fix:** Pick one name (`SetDetail` or `SetDetails`) and use it consistently everywhere. Remove the aliasing.

---

### 4. Potential `WebSocketMessage` Duplicate in Same File

**Problem:** There may be two definitions of `WebSocketMessage` interface in the same file.

| Location | Issue |
|---|---|
| `src/shared/context/hooks/useRealtimeSocket.tsx` | ⚠️ Check for duplicate `WebSocketMessage` interface definitions |

**Fix:** Open the file and verify — if duplicated, merge into a single definition.

---

## 🟡 MEDIUM PRIORITY — Structural Duplication

### 5. Widget Registry Pattern (Repeated 6+ Times)

**Problem:** Every feature screen has the same registry + defaults + storage key pattern copy-pasted.

Each of these files contains nearly identical structure:
- Registry object with `id`, `title`, `component`, `defaultSize`, `description`
- `DEFAULT_*_WIDGETS` array
- `* _WIDGETS_STORAGE` constant string
- `loadDefaultWidgets()` helper
- `isValidWidgetId()` helper

| Feature | File |
|---|---|
| Analytics | `src/features/analytics/widgets.tsx` |
| Home | `src/features/homescreen/widgets.ts` |
| Plan | `src/features/plan/widgets.tsx` |
| Workout | `src/features/workout/widgets.tsx` |
| Friends | `src/features/friends/widgets.ts` |
| Tracking | `src/features/tracking/tabs/` (multiple files) |

**Fix:** Create a factory function or generic helper in `shared/` that generates widget registries:

```typescript
// Example: src/shared/widgets/createWidgetRegistry.ts
export function createWidgetRegistry<T extends WidgetConfig>(
  storageKey: string,
  widgets: T[],
  defaults: string[]
) {
  return { /* registry logic */ };
}
```

---

### 6. Storage Key Naming Pattern Could Be Helperized

**Problem:** Storage keys follow the same `"${FEATURE}_WIDGETS_STORAGE_${userKey}"` pattern repeated manually.

| File | Storage Key |
|---|---|
| `analytics/widgets.tsx` | `ANALYTICS_WIDGETS_STORAGE` |
| `homescreen/widgets.ts` | `HOME_WIDGETS_STORAGE` |
| `plan/widgets.tsx` | `PLAN_WIDGETS_STORAGE` |
| `workout/widgets.tsx` | `WORKOUT_WIDGETS_STORAGE` |
| `friends/widgets.ts` | Multiple similar keys |

**Fix:** Add a helper to `shared/services/storage.tsx`:

```typescript
export function getFeatureWidgetsKey(feature: string) {
  return `${feature}_WIDGETS_STORAGE_${getUserKey()}`;
}
```

---

## 🟢 LOW PRIORITY — Semantic Aliases (May Be Intentional)

### 7. Context-Specific Type Aliases

These may be intentional for readability within a feature's domain:

| Original | Alias | Location | Question |
|---|---|---|---|
| `User` | `AuthUser` | `src/features/auth/types.ts` | Is the auth context different enough to justify a separate name? |
| `Exercise` | `ExercisePayload` | `src/features/plan/types.ts` | Is the plan context using a different shape? |
| `RecoveryMuscleGroup` | `MuscleGroup` | `src/features/tracking/types/` | Is tracking using a subset of the original type? |

**Fix:** If the underlying types are identical, remove the aliases. If they diverge, keep but document the differences.

---

## ✅ VERIFIED — No Issues (Good Patterns)

These were checked and confirmed as **not** duplicates:

- `formatDate` / `formatDateTime` / `formatClockTime` — centralized in `utils/format.tsx` ✓
- `saveToStorage` / `loadFromStorage` — single source in `shared/services/storage.tsx` ✓
- `levenshteinDistance` / `calculateSimilarity` — single source in `utils/exerciseMatching.tsx` ✓
- Day completion functions (`isSetComplete`, `isDayComplete`, etc.) — single source in `utils/dayCompletion.tsx` ✓
- Time estimation functions — single source in `utils/timeEstimation.tsx` ✓
- `authenticatedFetch` / `tokenStorage` / `getServerUrl` — clean separation ✓
- `WIDGET_SIZE_ORDER` constant — single source in `shared/types.ts` ✓
- `STORAGE_KEYS` constants — centralized ✓

---

## Action Checklist

- [ ] **H1:** Replace `generateWidgetId()` with `generateId("widget")`
- [ ] **H2:** Remove deprecated `SelectedLocation` and `SupplementLocationParams` from `supplements/types.ts`
- [ ] **H3:** Standardize `SetDetail` vs `SetDetails` naming
- [ ] **H4:** Check `useRealtimeSocket.tsx` for duplicate `WebSocketMessage`
- [ ] **M5:** Abstract widget registry pattern into shared factory function
- [ ] **M6:** Add storage key helper for feature widget keys
- [ ] **L7:** Review semantic aliases (`AuthUser`, `ExercisePayload`, `MuscleGroup`) and decide keep vs remove
