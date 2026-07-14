/**
 * ThemeContext.tsx
 *
 * Drop-in theme system for the workout tracker app.
 *
 * Usage:
 *   1. Wrap your root component with <ThemeProvider>
 *   2. Call useTheme() anywhere to get { theme, colors, isDark, ... }
 *   3. Replace hard-coded color strings with colors.XXX from the hook
 *
 * ─── Adding / editing built-in themes ─────────────────────────────────────
 * Built-in theme presets (light, dark, yellow, red, ...) live in
 * `themes.json`, next to this file — NOT in this TSX file.
 *
 * To add a new built-in theme:
 *   1. Open themes.json
 *   2. Copy an existing entry
 *   3. Give it a unique `id`, a `name` / `description`, and a full
 *      `colors` object containing every key from the ThemeColors
 *      interface below
 *   4. Save. It will automatically show up in `allThemes` (and therefore
 *      in any theme picker UI that maps over `allThemes`) — no changes
 *      to this file are needed.
 *
 * If an entry in themes.json is missing a color key, this file logs a
 * dev warning and fills the missing key in from a hardcoded fallback so
 * the app doesn't crash.
 *
 * Custom (user-created) themes are a separate, runtime concept: they can
 * be exported as JSON and shared with other users, who import them via
 * the ThemeEditorModal. Those are stored on-device with AsyncStorage and
 * are independent of the presets in themes.json.
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { useColorScheme } from "react-native"
import themesData from "../../context/themes.json"

// ─── Storage key ─────────────────────────────────────────────────────────────

const STORAGE_KEY = "app_theme_v1"

// ─── Theme token shape ────────────────────────────────────────────────────────

export interface ThemeColors {
  // Backgrounds
  background: string
  surface: string
  surfaceElevated: string
  surfaceBorder: string

  // Text
  textPrimary: string
  textSecondary: string
  textMuted: string
  textOnAccent: string

  // Accent / brand
  accent: string
  accentLight: string // ~15 % opacity tint
  accentDark: string // darker shade for shadows

  // Semantic
  success: string
  successLight: string
  error: string
  errorLight: string
  warning: string
  warningLight: string
  info: string
  infoLight: string

  // Misc
  separator: string
  shadow: string
  inputBackground: string
  inputBorder: string
  badgeBackground: string

  // Chart
  chartColor: string
  chartColorDark: string
}

// ─── Emergency fallback ───────────────────────────────────────────────────────
// Used only if themes.json is missing/unreadable, or if a theme entry in
// themes.json is missing one or more color keys. Day-to-day edits should
// happen in themes.json, not here.
const FALLBACK_COLORS: ThemeColors = {
  background: "#f5f5f5",
  surface: "#ffffff",
  surfaceElevated: "#ffffff",
  surfaceBorder: "#e0e0e0",

  textPrimary: "#111827",
  textSecondary: "#4b5563",
  textMuted: "#9ca3af",
  textOnAccent: "#ffffff",

  accent: "#667eea",
  accentLight: "#667eea22",
  accentDark: "#4f63c8",

  success: "#10b981",
  successLight: "#d1fae5",
  error: "#ef4444",
  errorLight: "#fef2f2",
  warning: "#f59e0b",
  warningLight: "#fef3c7",
  info: "#667eea",
  infoLight: "#ede9fe",

  separator: "#f3f4f6",
  shadow: "#000000",
  inputBackground: "#f9fafb",
  inputBorder: "#e5e7eb",
  badgeBackground: "#f3f4f6",

  chartColor: "#667eea",
  chartColorDark: "#4f63c8",
}

const REQUIRED_COLOR_KEYS = Object.keys(FALLBACK_COLORS) as Array<
  keyof ThemeColors
>

// ─── Loading & validating themes.json ─────────────────────────────────────────

interface RawTheme {
  id: string
  name: string
  description?: string
  author?: string
  version?: string
  createdAt?: string
  colors: Record<string, unknown>
}

/**
 * Ensures a theme's color object has every key required by ThemeColors.
 * Any missing/invalid keys fall back to FALLBACK_COLORS so a typo in
 * themes.json never crashes the app — it just logs a warning in dev.
 */
function normalizeColors(
  raw: Record<string, unknown> | undefined | null,
  themeId: string,
): ThemeColors {
  const result = {} as ThemeColors
  const missing: string[] = []

  for (const key of REQUIRED_COLOR_KEYS) {
    const value = raw?.[key]
    if (typeof value === "string") {
      result[key] = value
    } else {
      missing.push(key)
      result[key] = FALLBACK_COLORS[key]
    }
  }

  if (missing.length > 0 && typeof __DEV__ !== "undefined" && __DEV__) {
    console.warn(
      `[ThemeContext] Theme "${themeId}" in themes.json is missing color key(s): ${missing.join(
        ", ",
      )}. Using fallback values for those keys.`,
    )
  }

  return result
}

/**
 * Reads themes.json, validates each entry, and returns a clean list of
 * built-in theme presets (excluding the reserved "system" id).
 */
function loadBuiltInThemes(): AppTheme[] {
  const raw = Array.isArray(themesData) ? (themesData as RawTheme[]) : []
  const seen = new Set<string>()
  const result: AppTheme[] = []

  for (const entry of raw) {
    if (!entry || typeof entry.id !== "string" || !entry.id) {
      if (typeof __DEV__ !== "undefined" && __DEV__) {
        console.warn(
          "[ThemeContext] Skipping invalid entry in themes.json:",
          entry,
        )
      }
      continue
    }
    if (entry.id === "system") {
      if (typeof __DEV__ !== "undefined" && __DEV__) {
        console.warn(
          '[ThemeContext] "system" is a reserved theme id and is handled automatically; skipping this entry in themes.json.',
        )
      }
      continue
    }
    if (seen.has(entry.id)) {
      if (typeof __DEV__ !== "undefined" && __DEV__) {
        console.warn(
          `[ThemeContext] Duplicate theme id "${entry.id}" in themes.json; keeping the first occurrence.`,
        )
      }
      continue
    }
    seen.add(entry.id)

    result.push({
      id: entry.id,
      name: entry.name ?? entry.id,
      description: entry.description,
      author: entry.author,
      version: entry.version,
      createdAt: entry.createdAt,
      colors: normalizeColors(entry.colors, entry.id),
    })
  }

  if (result.length === 0 && typeof __DEV__ !== "undefined" && __DEV__) {
    console.warn(
      "[ThemeContext] No valid themes found in themes.json — falling back to a single built-in light theme.",
    )
    result.push({
      id: "light",
      name: "☀️ Light",
      description: "Clean white theme",
      colors: FALLBACK_COLORS,
    })
  }

  return result
}

const PRESET_THEMES: AppTheme[] = loadBuiltInThemes()

function findPreset(id: string): AppTheme | undefined {
  return PRESET_THEMES.find((t) => t.id === id)
}

// Kept as named exports for backwards compatibility with existing imports
// elsewhere in the app. New themes added to themes.json don't need (and
// won't get) a named export like this — look them up via `allThemes` or
// `PRESET_THEMES` by id instead.
export const LIGHT_COLORS: ThemeColors =
  findPreset("light")?.colors ?? FALLBACK_COLORS
export const DARK_COLORS: ThemeColors =
  findPreset("dark")?.colors ?? FALLBACK_COLORS
export const YELLOW_COLORS: ThemeColors =
  findPreset("yellow")?.colors ?? FALLBACK_COLORS
export const RED_COLORS: ThemeColors =
  findPreset("red")?.colors ?? FALLBACK_COLORS
export const GREEN_COLORS: ThemeColors =
  findPreset("green")?.colors ?? FALLBACK_COLORS
export const BLUE_COLORS: ThemeColors =
  findPreset("blue")?.colors ?? FALLBACK_COLORS
export const PINK_COLORS: ThemeColors =
  findPreset("pink")?.colors ?? FALLBACK_COLORS

// ─── Theme descriptor ─────────────────────────────────────────────────────────

export type ThemeId =
  | "light"
  | "dark"
  | "yellow"
  | "red"
  | "green"
  | "blue"
  | "pink"
  | "system"
  | string

export interface AppTheme {
  id: ThemeId
  name: string
  description?: string
  author?: string
  version?: string
  createdAt?: string
  colors: ThemeColors
}

const BUILT_IN_THEMES: AppTheme[] = [
  {
    id: "system",
    name: "System Default",
    description: "Follows your device's light/dark mode setting",
    colors: LIGHT_COLORS, // resolved at runtime
  },
  ...PRESET_THEMES,
]

// ─── Context value ────────────────────────────────────────────────────────────

export interface ThemeContextValue {
  /** Currently active theme descriptor */
  theme: AppTheme
  /** Resolved color tokens for the active theme */
  colors: ThemeColors
  /** Whether the resolved palette is considered "dark" */
  isDark: boolean
  /** The stored theme ID (may be "system") */
  activeThemeId: ThemeId
  /** All available themes (built-in + custom) */
  allThemes: AppTheme[]

  setTheme: (id: ThemeId) => Promise<void>
  saveCustomTheme: (theme: AppTheme) => Promise<void>
  deleteCustomTheme: (id: string) => Promise<void>
  exportTheme: (theme: AppTheme) => string
  importTheme: (json: string) => {
    success: boolean
    theme?: AppTheme
    error?: string
  }

  /** User-set chart color override (null = use theme default) */
  chartColorOverride: string | null
  chartColorDarkOverride: string | null
  setChartColorOverride: (
    color: string | null,
    dark?: string | null,
  ) => Promise<void>

  /** Resolved chart colors (override > theme default) */
  resolvedChartColor: string
  resolvedChartColorDark: string
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ThemeContext = createContext<ThemeContextValue | null>(null)

// ─── Persistence helpers ──────────────────────────────────────────────────────

interface PersistedState {
  activeThemeId: ThemeId
  customThemes: AppTheme[]
  chartColorOverride?: string | null
  chartColorDarkOverride?: string | null
}

async function loadState(): Promise<PersistedState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    if (!raw) return { activeThemeId: "system", customThemes: [] }
    return JSON.parse(raw) as PersistedState
  } catch {
    return { activeThemeId: "system", customThemes: [] }
  }
}

async function saveState(state: PersistedState): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // silent
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme() // "light" | "dark" | null

  const [activeThemeId, setActiveThemeId] = useState<ThemeId>("system")
  const [customThemes, setCustomThemes] = useState<AppTheme[]>([])
  const [chartColorOverride, setChartColorOverrideState] = useState<
    string | null
  >(null)
  const [chartColorDarkOverride, setChartColorDarkOverrideState] = useState<
    string | null
  >(null)
  const [loaded, setLoaded] = useState(false)

  // Load persisted state on mount
  useEffect(() => {
    loadState().then(
      ({
        activeThemeId: id,
        customThemes: custom,
        chartColorOverride: co,
        chartColorDarkOverride: cod,
      }) => {
        setActiveThemeId(id)
        setCustomThemes(custom)
        setChartColorOverrideState(co ?? null)
        setChartColorDarkOverrideState(cod ?? null)
        setLoaded(true)
      },
    )
  }, [])

  const allThemes: AppTheme[] = [...BUILT_IN_THEMES, ...customThemes]

  // Resolve the active theme
  const resolveTheme = useCallback((): AppTheme => {
    if (activeThemeId === "system") {
      const systemColors = systemScheme === "dark" ? DARK_COLORS : LIGHT_COLORS
      return {
        id: "system",
        name: "System Default",
        colors: systemColors,
      }
    }
    const found = allThemes.find((t) => t.id === activeThemeId)
    if (found) return found
    // Fallback to the first preset theme (light)
    return BUILT_IN_THEMES[1] ?? BUILT_IN_THEMES[0]!
  }, [activeThemeId, customThemes, systemScheme])

  const theme = resolveTheme()
  const colors = theme.colors
  const isDark = colors.background < "#888888" // cheap luminance heuristic

  const resolvedChartColor = chartColorOverride ?? colors.chartColor
  const resolvedChartColorDark = chartColorDarkOverride ?? colors.chartColorDark

  const setChartColorOverride = useCallback(
    async (color: string | null, dark: string | null = null) => {
      setChartColorOverrideState(color)
      setChartColorDarkOverrideState(dark)
      await saveState({
        activeThemeId,
        customThemes,
        chartColorOverride: color,
        chartColorDarkOverride: dark,
      })
    },
    [activeThemeId, customThemes],
  )

  const setTheme = useCallback(
    async (id: ThemeId) => {
      setActiveThemeId(id)
      await saveState({ activeThemeId: id, customThemes })
    },
    [customThemes],
  )

  const saveCustomTheme = useCallback(
    async (newTheme: AppTheme) => {
      const updated = customThemes.some((t) => t.id === newTheme.id)
        ? customThemes.map((t) => (t.id === newTheme.id ? newTheme : t))
        : [...customThemes, newTheme]

      setCustomThemes(updated)
      await saveState({ activeThemeId, customThemes: updated })
    },
    [customThemes, activeThemeId],
  )

  const deleteCustomTheme = useCallback(
    async (id: string) => {
      const updated = customThemes.filter((t) => t.id !== id)
      setCustomThemes(updated)
      const nextId = activeThemeId === id ? "system" : activeThemeId
      setActiveThemeId(nextId)
      await saveState({ activeThemeId: nextId, customThemes: updated })
    },
    [customThemes, activeThemeId],
  )

  const exportTheme = useCallback((t: AppTheme): string => {
    const exportable: AppTheme = {
      ...t,
      version: "1",
      createdAt: t.createdAt ?? new Date().toISOString(),
    }
    return JSON.stringify(exportable, null, 2)
  }, [])

  const importTheme = useCallback(
    (json: string): { success: boolean; theme?: AppTheme; error?: string } => {
      try {
        const parsed = JSON.parse(json) as Partial<AppTheme>

        if (!parsed.colors || typeof parsed.colors !== "object") {
          return {
            success: false,
            error: "Invalid theme: missing colors object.",
          }
        }

        // Validate that all required keys are present
        const required = REQUIRED_COLOR_KEYS
        const missing = required.filter((k) => !(k in parsed.colors!))
        if (missing.length > 0) {
          return {
            success: false,
            error: `Invalid theme: missing color keys: ${missing.join(", ")}`,
          }
        }

        // Ensure it has a unique id; collisions get a new id
        const isBuiltIn = BUILT_IN_THEMES.some((t) => t.id === parsed.id)
        const finalId =
          !parsed.id || isBuiltIn ? `custom_${Date.now()}` : parsed.id

        const finalTheme: AppTheme = {
          id: finalId,
          name: parsed.name ?? "Imported Theme",
          description: parsed.description,
          author: parsed.author,
          version: parsed.version,
          createdAt: parsed.createdAt,
          colors: parsed.colors as ThemeColors,
        }

        return { success: true, theme: finalTheme }
      } catch (e) {
        return { success: false, error: "Could not parse theme JSON." }
      }
    },
    [],
  )

  if (!loaded) return null // avoid flash before theme is ready

  return (
    <ThemeContext.Provider
      value={{
        theme,
        colors,
        isDark,
        activeThemeId,
        allThemes,
        setTheme,
        saveCustomTheme,
        deleteCustomTheme,
        exportTheme,
        importTheme,
        chartColorOverride,
        chartColorDarkOverride,
        setChartColorOverride,
        resolvedChartColor,
        resolvedChartColorDark,
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error("useTheme must be used inside <ThemeProvider>")
  }
  return ctx
}
