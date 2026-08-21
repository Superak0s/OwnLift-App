const LEGACY_KEYS: Record<string, string> = { setsByPerson: "setsBySplit" };

const walk = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(walk);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, val]) => [
      LEGACY_KEYS[key] ?? key,
      walk(val),
    ]),
  );
};

/**
 * Programs saved before the person→split rename store `setsByPerson`. Server
 * copies and on-device copies are both rewritten on read, so the migration
 * lands the next time the program is saved.
 */
export const migrateLegacyProgram = <T>(program: T): T => walk(program) as T;
