/**
 * ThemeEditorModal.tsx
 *
 * A full-screen modal that lets users:
 *   • Switch between built-in Light / Dark / System themes
 *   • Create a fully custom theme with a live color picker
 *   • Export any theme as a shareable JSON string
 *   • Import a theme from JSON shared by another user
 *   • Delete custom themes
 *
 * Usage in SettingsScreen (or anywhere):
 *
 *   import ThemeEditorModal from "../components/ThemeEditorModal"
 *
 *   <ThemeEditorModal
 *     visible={showThemeModal}
 *     onClose={() => setShowThemeModal(false)}
 *   />
 */

import React, { useState, useCallback } from "react"
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Share,
  Platform,
  Clipboard,
  ActivityIndicator,
} from "react-native"
import {
  useTheme,
  type AppTheme,
  type ThemeColors,
  LIGHT_COLORS,
  DARK_COLORS,
} from "../context/ThemeContext"
import { useAlert } from "./CustomAlert"
import ModalSheet from "./ModalSheet"

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "browse" | "create" | "import"

interface ColorRow {
  key: keyof ThemeColors
  label: string
  description: string
}

interface ThemeEditorModalProps {
  visible: boolean
  onClose: () => void
}

// ─── Color token metadata ─────────────────────────────────────────────────────

const COLOR_ROWS: ColorRow[] = [
  {
    key: "background",
    label: "Background",
    description: "Main screen background",
  },
  { key: "surface", label: "Surface", description: "Cards and panels" },
  {
    key: "surfaceElevated",
    label: "Surface Elevated",
    description: "Modals and elevated cards",
  },
  {
    key: "surfaceBorder",
    label: "Border",
    description: "Card and input borders",
  },
  {
    key: "textPrimary",
    label: "Text Primary",
    description: "Headings and body copy",
  },
  {
    key: "textSecondary",
    label: "Text Secondary",
    description: "Subtitles and labels",
  },
  {
    key: "textMuted",
    label: "Text Muted",
    description: "Placeholders and hints",
  },
  { key: "accent", label: "Accent", description: "Buttons and highlights" },
  {
    key: "accentLight",
    label: "Accent Tint",
    description: "Soft accent backgrounds",
  },
  {
    key: "accentDark",
    label: "Accent Dark",
    description: "Pressed accent / shadows",
  },
  { key: "success", label: "Success", description: "Positive states" },
  {
    key: "successLight",
    label: "Success Light",
    description: "Success chip background",
  },
  { key: "error", label: "Error", description: "Errors and destructive" },
  {
    key: "errorLight",
    label: "Error Light",
    description: "Error chip background",
  },
  { key: "warning", label: "Warning", description: "Caution states" },
  {
    key: "warningLight",
    label: "Warning Light",
    description: "Warning chip background",
  },
  {
    key: "inputBackground",
    label: "Input Background",
    description: "Text field backgrounds",
  },
  {
    key: "inputBorder",
    label: "Input Border",
    description: "Text field borders",
  },
  { key: "separator", label: "Separator", description: "Divider lines" },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return `custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

function isValidHex(hex: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(hex)
}

function darken(hex: string, amount = 0.2): string {
  try {
    const n = parseInt(hex.slice(1), 16)
    const r = Math.max(0, ((n >> 16) & 0xff) * (1 - amount)) | 0
    const g = Math.max(0, ((n >> 8) & 0xff) * (1 - amount)) | 0
    const b = Math.max(0, (n & 0xff) * (1 - amount)) | 0
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`
  } catch {
    return hex
  }
}

function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, "0")
  return `${hex.slice(0, 7)}${a}`
}

/** Derive a full ThemeColors object from just a few key values */
function deriveColors(
  bg: string,
  surface: string,
  accent: string,
  textPrimary: string,
): ThemeColors {
  return {
    background: bg,
    surface,
    surfaceElevated: surface,
    surfaceBorder: withAlpha(textPrimary, 0.12),
    textPrimary,
    textSecondary: withAlpha(textPrimary, 0.65),
    textMuted: withAlpha(textPrimary, 0.38),
    textOnAccent: "#ffffff",
    accent,
    accentLight: withAlpha(accent, 0.15),
    accentDark: darken(accent, 0.15),
    success: "#10b981",
    successLight: "#d1fae5",
    error: "#ef4444",
    errorLight: "#fef2f2",
    warning: "#f59e0b",
    warningLight: "#fef3c7",
    info: accent,
    infoLight: withAlpha(accent, 0.1),
    separator: withAlpha(textPrimary, 0.08),
    shadow: "#000000",
    inputBackground: withAlpha(textPrimary, 0.05),
    inputBorder: withAlpha(textPrimary, 0.15),
    badgeBackground: withAlpha(textPrimary, 0.08),
    chartColor: accent,
    chartColorDark: darken(accent, 0.15),
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ThemeCard({
  theme,
  isActive,
  onSelect,
  onExport,
  onDelete,
}: {
  theme: AppTheme
  isActive: boolean
  onSelect: () => void
  onExport: () => void
  onDelete?: () => void
}) {
  const c = theme.colors
  const isBuiltIn = ["light", "dark", "system"].includes(theme.id)

  return (
    <View
      style={[
        cardStyles.container,
        { borderColor: isActive ? c.accent : "#e0e0e0" },
        isActive && { borderWidth: 2.5, backgroundColor: c.accentLight },
      ]}
    >
      {/* Mini preview */}
      <View style={[cardStyles.preview, { backgroundColor: c.background }]}>
        <View style={[cardStyles.previewBar, { backgroundColor: c.surface }]}>
          <View
            style={[cardStyles.previewDot, { backgroundColor: c.accent }]}
          />
          <View
            style={[
              cardStyles.previewLine,
              { backgroundColor: c.textMuted, width: 40 },
            ]}
          />
        </View>
        <View style={[cardStyles.previewCard, { backgroundColor: c.surface }]}>
          <View
            style={[
              cardStyles.previewLine,
              { backgroundColor: c.textPrimary, width: 60, marginBottom: 4 },
            ]}
          />
          <View
            style={[
              cardStyles.previewLine,
              { backgroundColor: c.textMuted, width: 44 },
            ]}
          />
        </View>
        <View style={[cardStyles.previewBtn, { backgroundColor: c.accent }]} />
      </View>

      {/* Info */}
      <View style={cardStyles.info}>
        <View style={cardStyles.titleRow}>
          <Text style={cardStyles.name}>{theme.name}</Text>
          {isActive && (
            <View
              style={[cardStyles.activeBadge, { backgroundColor: c.accent }]}
            >
              <Text style={cardStyles.activeBadgeText}>Active</Text>
            </View>
          )}
        </View>
        {theme.description ? (
          <Text style={cardStyles.desc}>{theme.description}</Text>
        ) : null}
        {theme.author ? (
          <Text style={cardStyles.author}>by {theme.author}</Text>
        ) : null}

        <View style={cardStyles.actions}>
          <TouchableOpacity
            style={[
              cardStyles.btn,
              { backgroundColor: isActive ? "#e0e0e0" : c.accent },
            ]}
            onPress={onSelect}
          >
            <Text
              style={[
                cardStyles.btnText,
                { color: isActive ? "#666" : "#fff" },
              ]}
            >
              {isActive ? "Selected" : "Apply"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={cardStyles.iconBtn} onPress={onExport}>
            <Text style={cardStyles.iconBtnText}>📤</Text>
          </TouchableOpacity>

          {!isBuiltIn && onDelete && (
            <TouchableOpacity
              style={[cardStyles.iconBtn, { backgroundColor: "#fef2f2" }]}
              onPress={onDelete}
            >
              <Text style={cardStyles.iconBtnText}>🗑️</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  )
}

const cardStyles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: 1.5,
    backgroundColor: "#fff",
    marginBottom: 14,
    overflow: "hidden",
    flexDirection: "row",
  },
  preview: {
    width: 90,
    padding: 8,
    justifyContent: "space-between",
  },
  previewBar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 4,
    padding: 4,
    marginBottom: 4,
    gap: 4,
  },
  previewDot: { width: 6, height: 6, borderRadius: 3 },
  previewLine: { height: 4, borderRadius: 2 },
  previewCard: {
    borderRadius: 6,
    padding: 6,
    marginBottom: 4,
  },
  previewBtn: {
    height: 14,
    borderRadius: 7,
  },
  info: { flex: 1, padding: 12 },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  name: { fontSize: 15, fontWeight: "700", color: "#1a1a2e", flex: 1 },
  activeBadge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  activeBadgeText: { fontSize: 10, fontWeight: "700", color: "#fff" },
  desc: { fontSize: 12, color: "#666", marginBottom: 4, lineHeight: 16 },
  author: { fontSize: 11, color: "#999", marginBottom: 8, fontStyle: "italic" },
  actions: { flexDirection: "row", gap: 8, alignItems: "center" },
  btn: {
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  btnText: { fontSize: 13, fontWeight: "700" },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnText: { fontSize: 16 },
})

// ─── Color picker row ─────────────────────────────────────────────────────────

function ColorPickerRow({
  row,
  value,
  onChange,
}: {
  row: ColorRow
  value: string
  onChange: (key: keyof ThemeColors, val: string) => void
}) {
  const [localVal, setLocalVal] = useState(value)
  const valid = isValidHex(localVal)

  const commit = () => {
    if (isValidHex(localVal)) onChange(row.key, localVal)
    else setLocalVal(value) // revert invalid
  }

  return (
    <View style={pickerStyles.row}>
      <View
        style={[
          pickerStyles.swatch,
          { backgroundColor: valid ? localVal : value },
        ]}
      />
      <View style={pickerStyles.labelCol}>
        <Text style={pickerStyles.label}>{row.label}</Text>
        <Text style={pickerStyles.desc}>{row.description}</Text>
      </View>
      <TextInput
        style={[pickerStyles.input, !valid && pickerStyles.inputError]}
        value={localVal}
        onChangeText={(t) => {
          const v = t.startsWith("#") ? t : `#${t}`
          setLocalVal(v)
          if (isValidHex(v)) onChange(row.key, v)
        }}
        onBlur={commit}
        placeholder='#rrggbb'
        placeholderTextColor='#bbb'
        autoCapitalize='none'
        autoCorrect={false}
        maxLength={9}
      />
    </View>
  )
}

const pickerStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  swatch: {
    width: 30,
    height: 30,
    borderRadius: 8,
    marginRight: 10,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  labelCol: { flex: 1 },
  label: { fontSize: 13, fontWeight: "600", color: "#1a1a2e" },
  desc: { fontSize: 11, color: "#999" },
  input: {
    width: 90,
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    color: "#333",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  inputError: { borderColor: "#ef4444" },
})

// ─── Main component ───────────────────────────────────────────────────────────

export default function ThemeEditorModal({
  visible,
  onClose,
}: ThemeEditorModalProps) {
  const {
    colors,
    allThemes,
    activeThemeId,
    setTheme,
    saveCustomTheme,
    deleteCustomTheme,
    exportTheme,
    importTheme,
  } = useTheme()
  const { alert, AlertComponent } = useAlert()

  const [tab, setTab] = useState<Tab>("browse")

  // ── Create tab state ──────────────────────────────────────────────────────
  const [themeName, setThemeName] = useState("")
  const [themeAuthor, setThemeAuthor] = useState("")
  const [themeDesc, setThemeDesc] = useState("")
  const [basePreset, setBasePreset] = useState<"light" | "dark">("light")

  // Quick-derive fields
  const [bgColor, setBgColor] = useState(LIGHT_COLORS.background)
  const [surfaceColor, setSurfaceColor] = useState(LIGHT_COLORS.surface)
  const [accentColor, setAccentColor] = useState(LIGHT_COLORS.accent)
  const [textColor, setTextColor] = useState(LIGHT_COLORS.textPrimary)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [advancedColors, setAdvancedColors] =
    useState<ThemeColors>(LIGHT_COLORS)
  const [saving, setSaving] = useState(false)

  // ── Import tab state ──────────────────────────────────────────────────────
  const [importJson, setImportJson] = useState("")

  // ── Export sheet ──────────────────────────────────────────────────────────
  const [exportJson, setExportJson] = useState("")
  const [showExportSheet, setShowExportSheet] = useState(false)

  // ── Derived colors for preview ────────────────────────────────────────────
  const previewColors = showAdvanced
    ? advancedColors
    : deriveColors(bgColor, surfaceColor, accentColor, textColor)

  const resetCreate = () => {
    setThemeName("")
    setThemeAuthor("")
    setThemeDesc("")
    setBasePreset("light")
    setBgColor(LIGHT_COLORS.background)
    setSurfaceColor(LIGHT_COLORS.surface)
    setAccentColor(LIGHT_COLORS.accent)
    setTextColor(LIGHT_COLORS.textPrimary)
    setShowAdvanced(false)
    setAdvancedColors(LIGHT_COLORS)
  }

  const applyPreset = (preset: "light" | "dark") => {
    const c = preset === "light" ? LIGHT_COLORS : DARK_COLORS
    setBasePreset(preset)
    setBgColor(c.background)
    setSurfaceColor(c.surface)
    setAccentColor(c.accent)
    setTextColor(c.textPrimary)
    setAdvancedColors(c)
  }

  const handleAdvancedChange = (key: keyof ThemeColors, val: string) => {
    setAdvancedColors((prev) => ({ ...prev, [key]: val }))
  }

  const handleSaveCustom = async () => {
    if (!themeName.trim()) {
      alert(
        "Name required",
        "Please give your theme a name.",
        [{ text: "OK" }],
        "error",
      )
      return
    }
    setSaving(true)
    const finalColors = showAdvanced
      ? advancedColors
      : deriveColors(bgColor, surfaceColor, accentColor, textColor)

    const newTheme: AppTheme = {
      id: generateId(),
      name: themeName.trim(),
      description: themeDesc.trim() || undefined,
      author: themeAuthor.trim() || undefined,
      version: "1",
      createdAt: new Date().toISOString(),
      colors: finalColors,
    }

    await saveCustomTheme(newTheme)
    await setTheme(newTheme.id)
    setSaving(false)
    resetCreate()
    setTab("browse")
    alert(
      "Theme saved!",
      `"${newTheme.name}" is now active.`,
      [{ text: "🎉 Awesome" }],
      "success",
    )
  }

  const handleExport = (theme: AppTheme) => {
    const json = exportTheme(theme)
    setExportJson(json)
    setShowExportSheet(true)
  }

  const handleShareExport = async () => {
    try {
      await Share.share({ title: "Workout Tracker Theme", message: exportJson })
    } catch {
      // user cancelled
    }
  }

  const handleCopyExport = () => {
    Clipboard.setString(exportJson)
    alert(
      "Copied!",
      "Theme JSON copied to clipboard.",
      [{ text: "OK" }],
      "success",
    )
  }

  const handleImport = async () => {
    if (!importJson.trim()) {
      alert(
        "Empty input",
        "Please paste a theme JSON first.",
        [{ text: "OK" }],
        "error",
      )
      return
    }
    const result = importTheme(importJson.trim())
    if (!result.success || !result.theme) {
      alert(
        "Import failed",
        result.error ?? "Unknown error.",
        [{ text: "OK" }],
        "error",
      )
      return
    }
    await saveCustomTheme(result.theme)
    await setTheme(result.theme.id)
    setImportJson("")
    setTab("browse")
    alert(
      "Theme imported!",
      `"${result.theme.name}" has been added and applied.`,
      [{ text: "🎉 Let's go" }],
      "success",
    )
  }

  const handleDelete = (theme: AppTheme) => {
    alert(
      `Delete "${theme.name}"?`,
      "This theme will be permanently removed.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteCustomTheme(theme.id)
          },
        },
      ],
      "warning",
    )
  }

  return (
    <ModalSheet
      visible={visible}
      onClose={onClose}
      title='🎨 Themes'
      showCancelButton={false}
      showConfirmButton={false}
      fullHeight
    >
      {/* ── Tabs ── */}
      <View style={[s.tabBar, { borderBottomColor: colors.surfaceBorder }]}>
        {(["browse", "create", "import"] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[
              s.tab,
              tab === t && {
                borderBottomColor: colors.accent,
                borderBottomWidth: 2.5,
              },
            ]}
            onPress={() => setTab(t)}
          >
            <Text
              style={[
                s.tabText,
                { color: tab === t ? colors.accent : colors.textMuted },
                tab === t && s.tabTextActive,
              ]}
            >
              {t === "browse" ? "Browse" : t === "create" ? "Create" : "Import"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Content ── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps='handled'
        showsVerticalScrollIndicator={false}
      >
        {/* ══════════════ BROWSE TAB ══════════════ */}
        {tab === "browse" && (
          <View>
            <Text style={[s.sectionHeader, { color: colors.textSecondary }]}>
              BUILT-IN
            </Text>
            {allThemes
              .filter((t) => ["system", "light", "dark"].includes(t.id))
              .map((t) => (
                <ThemeCard
                  key={t.id}
                  theme={t}
                  isActive={activeThemeId === t.id}
                  onSelect={() => setTheme(t.id)}
                  onExport={() => handleExport(t)}
                />
              ))}

            {allThemes.filter(
              (t) => !["system", "light", "dark"].includes(t.id),
            ).length > 0 && (
              <>
                <Text
                  style={[
                    s.sectionHeader,
                    { color: colors.textSecondary, marginTop: 8 },
                  ]}
                >
                  CUSTOM
                </Text>
                {allThemes
                  .filter((t) => !["system", "light", "dark"].includes(t.id))
                  .map((t) => (
                    <ThemeCard
                      key={t.id}
                      theme={t}
                      isActive={activeThemeId === t.id}
                      onSelect={() => setTheme(t.id)}
                      onExport={() => handleExport(t)}
                      onDelete={() => handleDelete(t)}
                    />
                  ))}
              </>
            )}

            <TouchableOpacity
              style={[
                s.createCta,
                {
                  borderColor: colors.accent,
                  backgroundColor: colors.accentLight,
                },
              ]}
              onPress={() => setTab("create")}
            >
              <Text style={[s.createCtaText, { color: colors.accent }]}>
                ✨ Create a custom theme
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ══════════════ CREATE TAB ══════════════ */}
        {tab === "create" && (
          <View>
            {/* Live preview strip */}
            <View
              style={[
                s.previewStrip,
                { backgroundColor: previewColors.background },
              ]}
            >
              <View
                style={[
                  s.previewStripBar,
                  { backgroundColor: previewColors.surface },
                ]}
              >
                <View
                  style={[
                    s.previewStripDot,
                    { backgroundColor: previewColors.accent },
                  ]}
                />
                <Text
                  style={[
                    s.previewStripTitle,
                    { color: previewColors.textPrimary },
                  ]}
                >
                  {themeName || "My Theme"}
                </Text>
              </View>
              <View
                style={[
                  s.previewStripCard,
                  {
                    backgroundColor: previewColors.surface,
                    borderColor: previewColors.surfaceBorder,
                  },
                ]}
              >
                <Text
                  style={[
                    s.previewStripHeading,
                    { color: previewColors.textPrimary },
                  ]}
                >
                  Workout Day 1
                </Text>
                <Text
                  style={[
                    s.previewStripSub,
                    { color: previewColors.textSecondary },
                  ]}
                >
                  3 exercises · 45 min
                </Text>
                <View
                  style={[
                    s.previewStripBtn,
                    { backgroundColor: previewColors.accent },
                  ]}
                >
                  <Text
                    style={{
                      color: previewColors.textOnAccent,
                      fontWeight: "700",
                      fontSize: 12,
                    }}
                  >
                    Start
                  </Text>
                </View>
              </View>
            </View>

            {/* Theme meta */}
            <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>
              THEME NAME *
            </Text>
            <TextInput
              style={[
                s.textInput,
                {
                  backgroundColor: colors.inputBackground,
                  borderColor: colors.inputBorder,
                  color: colors.textPrimary,
                },
              ]}
              value={themeName}
              onChangeText={setThemeName}
              placeholder='My Awesome Theme'
              placeholderTextColor={colors.textMuted}
            />

            <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>
              AUTHOR (optional)
            </Text>
            <TextInput
              style={[
                s.textInput,
                {
                  backgroundColor: colors.inputBackground,
                  borderColor: colors.inputBorder,
                  color: colors.textPrimary,
                },
              ]}
              value={themeAuthor}
              onChangeText={setThemeAuthor}
              placeholder='@yourusername'
              placeholderTextColor={colors.textMuted}
            />

            <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>
              DESCRIPTION (optional)
            </Text>
            <TextInput
              style={[
                s.textInput,
                s.textArea,
                {
                  backgroundColor: colors.inputBackground,
                  borderColor: colors.inputBorder,
                  color: colors.textPrimary,
                },
              ]}
              value={themeDesc}
              onChangeText={setThemeDesc}
              placeholder='A brief description of your theme…'
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={2}
            />

            {/* Base preset */}
            <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>
              START FROM
            </Text>
            <View style={s.presetRow}>
              {(["light", "dark"] as const).map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[
                    s.presetChip,
                    {
                      borderColor: colors.inputBorder,
                      backgroundColor: colors.surface,
                    },
                    basePreset === p && {
                      borderColor: colors.accent,
                      backgroundColor: colors.accentLight,
                    },
                  ]}
                  onPress={() => applyPreset(p)}
                >
                  <Text style={{ fontSize: 18 }}>
                    {p === "light" ? "☀️" : "🌙"}
                  </Text>
                  <Text
                    style={[
                      s.presetChipLabel,
                      {
                        color:
                          basePreset === p ? colors.accent : colors.textPrimary,
                      },
                    ]}
                  >
                    {p === "light" ? "Light" : "Dark"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Quick colors */}
            <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>
              QUICK COLORS
            </Text>
            <Text style={[s.hint, { color: colors.textMuted }]}>
              These four values auto-generate the rest of the palette.
            </Text>

            <View
              style={[
                s.quickColorsCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.surfaceBorder,
                },
              ]}
            >
              {(
                [
                  { label: "Background", val: bgColor, set: setBgColor },
                  {
                    label: "Surface",
                    val: surfaceColor,
                    set: setSurfaceColor,
                  },
                  { label: "Accent", val: accentColor, set: setAccentColor },
                  { label: "Text", val: textColor, set: setTextColor },
                ] as const
              ).map(({ label, val, set }) => (
                <View key={label} style={s.quickColorRow}>
                  <View style={[s.quickSwatch, { backgroundColor: val }]} />
                  <Text
                    style={[s.quickColorLabel, { color: colors.textPrimary }]}
                  >
                    {label}
                  </Text>
                  <TextInput
                    style={[
                      s.quickColorInput,
                      {
                        backgroundColor: colors.inputBackground,
                        borderColor: colors.inputBorder,
                        color: colors.textPrimary,
                      },
                      !isValidHex(val) && { borderColor: "#ef4444" },
                    ]}
                    value={val}
                    onChangeText={(t) => {
                      const v = t.startsWith("#") ? t : `#${t}`
                      set(v)
                    }}
                    placeholder='#rrggbb'
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize='none'
                    autoCorrect={false}
                    maxLength={9}
                  />
                </View>
              ))}
            </View>

            {/* Advanced toggle */}
            <TouchableOpacity
              style={[s.advancedToggle, { borderColor: colors.surfaceBorder }]}
              onPress={() => {
                if (!showAdvanced) {
                  setAdvancedColors(
                    deriveColors(bgColor, surfaceColor, accentColor, textColor),
                  )
                }
                setShowAdvanced(!showAdvanced)
              }}
            >
              <Text style={[s.advancedToggleText, { color: colors.accent }]}>
                {showAdvanced ? "⬆ Hide" : "⬇ Show"} Advanced Color Editor
              </Text>
            </TouchableOpacity>

            {showAdvanced && (
              <View
                style={[
                  s.advancedCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.surfaceBorder,
                  },
                ]}
              >
                <Text
                  style={[
                    s.fieldLabel,
                    { color: colors.textSecondary, marginBottom: 12 },
                  ]}
                >
                  ALL COLOR TOKENS
                </Text>
                {COLOR_ROWS.map((row) => (
                  <ColorPickerRow
                    key={row.key}
                    row={row}
                    value={advancedColors[row.key]}
                    onChange={handleAdvancedChange}
                  />
                ))}
              </View>
            )}

            {/* Save */}
            <TouchableOpacity
              style={[
                s.saveBtn,
                { backgroundColor: colors.accent },
                saving && { opacity: 0.6 },
              ]}
              onPress={handleSaveCustom}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color='#fff' />
              ) : (
                <Text style={s.saveBtnText}>✓ Save & Apply Theme</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* ══════════════ IMPORT TAB ══════════════ */}
        {tab === "import" && (
          <View>
            <View
              style={[
                s.importInfoCard,
                {
                  backgroundColor: colors.accentLight,
                  borderColor: colors.accent,
                },
              ]}
            >
              <Text style={s.importInfoIcon}>📥</Text>
              <Text style={[s.importInfoTitle, { color: colors.accent }]}>
                Import a Theme
              </Text>
              <Text style={[s.importInfoText, { color: colors.textSecondary }]}>
                Paste a theme JSON shared by another user. You can get one by
                tapping <Text style={{ fontWeight: "700" }}>📤 Export</Text> on
                any theme in the Browse tab.
              </Text>
            </View>

            <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>
              PASTE THEME JSON
            </Text>
            <TextInput
              style={[
                s.textInput,
                s.jsonInput,
                {
                  backgroundColor: colors.inputBackground,
                  borderColor: colors.inputBorder,
                  color: colors.textPrimary,
                },
              ]}
              value={importJson}
              onChangeText={setImportJson}
              placeholder={
                '{\n  "id": "custom_123",\n  "name": "My Theme",\n  "colors": { ... }\n}'
              }
              placeholderTextColor={colors.textMuted}
              multiline
              autoCapitalize='none'
              autoCorrect={false}
            />

            <TouchableOpacity
              style={[s.saveBtn, { backgroundColor: colors.accent }]}
              onPress={handleImport}
            >
              <Text style={s.saveBtnText}>📥 Import Theme</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* ── Export sheet ── */}
      <ModalSheet
        visible={showExportSheet}
        onClose={() => setShowExportSheet(false)}
        title='📤 Export Theme'
        subtitle='Share this JSON with other users so they can import your theme.'
        showCancelButton={false}
        showConfirmButton={false}
      >
        <ScrollView
          style={[
            s.exportJsonScroll,
            { backgroundColor: colors.inputBackground },
          ]}
          contentContainerStyle={{ padding: 12 }}
        >
          <Text style={[s.exportJsonText, { color: colors.textPrimary }]}>
            {exportJson}
          </Text>
        </ScrollView>

        <View style={s.exportActions}>
          <TouchableOpacity
            style={[s.exportBtn, { backgroundColor: colors.inputBackground }]}
            onPress={handleCopyExport}
          >
            <Text style={[s.exportBtnText, { color: colors.textPrimary }]}>
              📋 Copy
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.exportBtn, { backgroundColor: colors.accent }]}
            onPress={handleShareExport}
          >
            <Text style={[s.exportBtnText, { color: colors.textOnAccent }]}>
              🔗 Share
            </Text>
          </TouchableOpacity>
        </View>
      </ModalSheet>

      {AlertComponent}
    </ModalSheet>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderBottomWidth: 2.5,
    borderBottomColor: "transparent",
  },
  tabText: { fontSize: 14, fontWeight: "600" },
  tabTextActive: { fontWeight: "800" },
  content: { paddingTop: 8, paddingBottom: 32 },
  sectionHeader: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 4,
  },
  createCta: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderRadius: 14,
    padding: 18,
    alignItems: "center",
    marginTop: 8,
  },
  createCtaText: { fontSize: 15, fontWeight: "700" },

  // Preview strip
  previewStrip: {
    borderRadius: 16,
    padding: 12,
    marginBottom: 20,
  },
  previewStripBar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    gap: 8,
  },
  previewStripDot: { width: 10, height: 10, borderRadius: 5 },
  previewStripTitle: { fontSize: 14, fontWeight: "700" },
  previewStripCard: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
  },
  previewStripHeading: { fontSize: 15, fontWeight: "700", marginBottom: 4 },
  previewStripSub: { fontSize: 12, marginBottom: 12 },
  previewStripBtn: {
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center",
  },

  // Form
  fieldLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.7,
    marginBottom: 6,
    marginTop: 16,
  },
  hint: { fontSize: 12, marginBottom: 10, lineHeight: 17 },
  textInput: {
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 14,
    fontSize: 15,
  },
  textArea: { minHeight: 60, textAlignVertical: "top" },

  presetRow: { flexDirection: "row", gap: 12 },
  presetChip: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    gap: 6,
  },
  presetChipLabel: { fontSize: 14, fontWeight: "700" },

  quickColorsCard: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 14,
    gap: 10,
  },
  quickColorRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  quickSwatch: {
    width: 28,
    height: 28,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "#00000020",
  },
  quickColorLabel: { flex: 1, fontSize: 13, fontWeight: "600" },
  quickColorInput: {
    width: 100,
    borderRadius: 8,
    borderWidth: 1,
    padding: 8,
    fontSize: 13,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },

  advancedToggle: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
  },
  advancedToggleText: { fontSize: 14, fontWeight: "700" },

  advancedCard: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 14,
    marginTop: 12,
  },

  saveBtn: {
    marginTop: 20,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },

  // Import tab
  importInfoCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 20,
    alignItems: "center",
    marginBottom: 4,
  },
  importInfoIcon: { fontSize: 40, marginBottom: 8 },
  importInfoTitle: { fontSize: 17, fontWeight: "800", marginBottom: 8 },
  importInfoText: { fontSize: 13, textAlign: "center", lineHeight: 19 },
  jsonInput: {
    minHeight: 160,
    textAlignVertical: "top",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 12,
  },

  // Export sheet
  exportJsonScroll: {
    borderRadius: 12,
    maxHeight: 200,
    marginBottom: 4,
  },
  exportJsonText: {
    fontSize: 11,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    lineHeight: 16,
  },
  exportActions: { flexDirection: "row", gap: 12, marginTop: 4 },
  exportBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
  },
  exportBtnText: { fontSize: 15, fontWeight: "700" },
})
