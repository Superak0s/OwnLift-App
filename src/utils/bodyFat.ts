import type { Gender } from "@features/tracking/types"

/** US Navy body fat method. All measurements in the same unit (cm or inches). */
export function calculateBodyFatPercentage(
  gender: Gender,
  height: number,
  waist: number,
  neck: number,
  hip: number | null = null,
): number {
  let bodyFatPercentage: number

  if (gender === "male") {
    bodyFatPercentage =
      495 /
        (1.0324 -
          0.19077 * Math.log10(waist - neck) +
          0.15456 * Math.log10(height)) -
      450
  } else {
    if (!hip)
      throw new Error("Hip measurement required for female calculation")
    bodyFatPercentage =
      495 /
        (1.29579 -
          0.35004 * Math.log10(waist + hip - neck) +
          0.221 * Math.log10(height)) -
      450
  }

  return parseFloat(bodyFatPercentage.toFixed(1))
}
