const FIVE_BAND = ["#6BCB77", "#FFD93D", "#FFA94D", "#FF8787", "#FF6B6B"] as const;
const THREE_BAND = ["#6BCB77", "#FFD93D", "#FF6B6B"] as const;

/**
 * Maps a 0-10 severity/pain/intensity value to a green-to-red color.
 * `bands` selects the granularity used across the app: 5 stops (soreness/intensity
 * screens) or 3 stops (pain-level screens).
 */
export function getSeverityColor(value: number, bands: 3 | 5 = 5): string {
  if (bands === 3) {
    if (value <= 3) return THREE_BAND[0];
    if (value <= 6) return THREE_BAND[1];
    return THREE_BAND[2];
  }
  if (value <= 2) return FIVE_BAND[0];
  if (value <= 4) return FIVE_BAND[1];
  if (value <= 6) return FIVE_BAND[2];
  if (value <= 8) return FIVE_BAND[3];
  return FIVE_BAND[4];
}
