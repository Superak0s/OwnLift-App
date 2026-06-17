import React, { useState, useEffect, useCallback } from "react"
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { supplementsApi } from "../services/api"
import type {
  SupplementSummary,
  SupplementEntry,
  CreateSupplementParams,
} from "../services/api"
import QuickLogSupplement from "../components/QuickLogSupplement"
import ModalSheet from "../components/ModalSheet"
import { useAlert } from "../components/CustomAlert"
import { useTheme } from "../context/ThemeContext"
import type { ThemeColors } from "../context/ThemeContext"
import SupplementSettingsModal from "../components/SupplementSettingsModal"

// ─── Default supplement templates ─────────────────────────────────────────────

interface SupplementTemplate {
  name: string
  icon: string
  unit: string
  defaultAmount: number
  color: string
  description: string
}

const DEFAULT_SUPPLEMENT_TEMPLATES: SupplementTemplate[] = [
  {
    name: "Creatine",
    icon: "💪",
    unit: "g",
    defaultAmount: 5,
    color: "#6d28d9",
    description: "Strength & muscle growth",
  },
  {
    name: "Protein",
    icon: "🥛",
    unit: "g",
    defaultAmount: 30,
    color: "#0ea5e9",
    description: "Muscle recovery & growth",
  },
  {
    name: "Vitamin D",
    icon: "☀️",
    unit: "IU",
    defaultAmount: 2000,
    color: "#f59e0b",
    description: "Bone health & immunity",
  },
  {
    name: "Omega-3",
    icon: "🐟",
    unit: "mg",
    defaultAmount: 1000,
    color: "#0891b2",
    description: "Heart & brain health",
  },
  {
    name: "Magnesium",
    icon: "🧲",
    unit: "mg",
    defaultAmount: 400,
    color: "#059669",
    description: "Sleep & muscle function",
  },
  {
    name: "Zinc",
    icon: "⚡",
    unit: "mg",
    defaultAmount: 15,
    color: "#dc2626",
    description: "Immune support & testosterone",
  },
  {
    name: "Caffeine",
    icon: "☕",
    unit: "mg",
    defaultAmount: 200,
    color: "#78350f",
    description: "Energy & focus",
  },
  {
    name: "Ashwagandha",
    icon: "🌿",
    unit: "mg",
    defaultAmount: 600,
    color: "#65a30d",
    description: "Stress & cortisol support",
  },
]

// ─── Component ────────────────────────────────────────────────────────────────

export default function SupplementsScreen(): React.JSX.Element {
  const { colors } = useTheme()
  const styles = makeStyles(colors)
  const { alert, AlertComponent } = useAlert()

  const [supplements, setSupplements] = useState<SupplementSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Add supplement sheet
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [showTemplateSheet, setShowTemplateSheet] = useState(false)

  // Custom supplement form
  const [newName, setNewName] = useState("")
  const [newUnit, setNewUnit] = useState("g")
  const [newAmount, setNewAmount] = useState("5")
  const [newIcon, setNewIcon] = useState("💊")
  const [saving, setSaving] = useState(false)

  // Quick log
  const [quickLogSupplement, setQuickLogSupplement] =
    useState<SupplementSummary | null>(null)

  // Settings modal
  const [settingsSupplement, setSettingsSupplement] =
    useState<SupplementSummary | null>(null)

  // History modal
  const [historySupp, setHistorySupp] = useState<SupplementSummary | null>(null)
  const [history, setHistory] = useState<SupplementEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [showHistorySheet, setShowHistorySheet] = useState(false)

  const loadSupplements = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    try {
      const res = await supplementsApi.list()
      setSupplements(res.supplements)
    } catch (err) {
      console.error("Failed to load supplements:", err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void loadSupplements()
  }, [loadSupplements])

  const handleRefresh = () => {
    setRefreshing(true)
    void loadSupplements(true)
  }

  // ── Add supplement ──────────────────────────────────────────────────────────

  const handleAddFromTemplate = async (template: SupplementTemplate) => {
    setSaving(true)
    try {
      const params: CreateSupplementParams = {
        name: template.name,
        unit: template.unit,
        defaultAmount: template.defaultAmount,
        icon: template.icon,
        color: template.color,
      }
      await supplementsApi.create(params)
      setShowTemplateSheet(false)
      await loadSupplements(true)
    } catch (err) {
      alert(
        "Error",
        err instanceof Error ? err.message : "Failed to add supplement",
        [{ text: "OK" }],
        "error",
      )
    } finally {
      setSaving(false)
    }
  }

  const handleAddCustom = async () => {
    if (!newName.trim()) {
      alert(
        "Missing Name",
        "Please enter a supplement name.",
        [{ text: "OK" }],
        "warning",
      )
      return
    }
    const amt = parseFloat(newAmount)
    if (isNaN(amt) || amt <= 0) {
      alert(
        "Invalid Amount",
        "Please enter a valid default amount.",
        [{ text: "OK" }],
        "error",
      )
      return
    }
    setSaving(true)
    try {
      await supplementsApi.create({
        name: newName.trim(),
        unit: newUnit.trim() || "g",
        defaultAmount: amt,
        icon: newIcon || "💊",
      })
      setShowAddSheet(false)
      setNewName("")
      setNewUnit("g")
      setNewAmount("5")
      setNewIcon("💊")
      await loadSupplements(true)
    } catch (err) {
      alert(
        "Error",
        err instanceof Error ? err.message : "Failed to add supplement",
        [{ text: "OK" }],
        "error",
      )
    } finally {
      setSaving(false)
    }
  }

  // ── Quick log ───────────────────────────────────────────────────────────────

  const handleLog = async (
    supp: SupplementSummary,
    amount: number,
    note: string,
  ) => {
    try {
      await supplementsApi.log(supp.id, { amount, note: note || null })
      await loadSupplements(true)
    } catch (err) {
      alert(
        "Log Failed",
        err instanceof Error ? err.message : "Could not log supplement",
        [{ text: "OK" }],
        "error",
      )
    }
  }

  // ── History ─────────────────────────────────────────────────────────────────

  const openHistory = async (supp: SupplementSummary) => {
    setHistorySupp(supp)
    setShowHistorySheet(true)
    setHistoryLoading(true)
    try {
      const res = await supplementsApi.getLog(supp.id, 30)
      setHistory(res.entries)
    } catch {
      setHistory([])
    } finally {
      setHistoryLoading(false)
    }
  }

  const handleDeleteEntry = (entry: SupplementEntry) => {
    alert(
      "Delete Entry",
      "Remove this log entry?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await supplementsApi.deleteLogEntry(entry.supplementId, entry.id)
              setHistory((prev) => prev.filter((e) => e.id !== entry.id))
              await loadSupplements(true)
            } catch (err) {
              alert(
                "Error",
                err instanceof Error ? err.message : "Failed",
                [{ text: "OK" }],
                "error",
              )
            }
          },
        },
      ],
      "warning",
    )
  }

  // ── Delete supplement ───────────────────────────────────────────────────────

  const handleDeleteSupplement = (supp: SupplementSummary) => {
    alert(
      `Delete ${supp.name}?`,
      "This will permanently delete the supplement and all its history.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await supplementsApi.delete(supp.id)
              setSupplements((prev) => prev.filter((s) => s.id !== supp.id))
            } catch (err) {
              alert(
                "Error",
                err instanceof Error ? err.message : "Failed",
                [{ text: "OK" }],
                "error",
              )
            }
          },
        },
      ],
      "error",
    )
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return (
      d.toLocaleDateString([], { month: "short", day: "numeric" }) +
      " " +
      d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    )
  }

  const alreadyAdded = (template: SupplementTemplate) =>
    supplements.some(
      (s) => s.name.toLowerCase() === template.name.toLowerCase(),
    )

  // ─── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size='large' color={colors.accent} />
          <Text style={styles.loadingText}>Loading supplements…</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.accent}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Supplements</Text>
            <Text style={styles.headerSubtitle}>
              {supplements.length === 0
                ? "No supplements yet"
                : `${supplements.length} supplement${supplements.length !== 1 ? "s" : ""} · ${supplements.filter((s) => s.takenToday).length} taken today`}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowTemplateSheet(true)}
          >
            <Text style={styles.addButtonText}>+ Add</Text>
          </TouchableOpacity>
        </View>

        {/* Empty state */}
        {supplements.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>💊</Text>
            <Text style={styles.emptyTitle}>No supplements yet</Text>
            <Text style={styles.emptySubtitle}>
              Add supplements to track your daily intake and set reminders.
            </Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => setShowTemplateSheet(true)}
            >
              <Text style={styles.emptyButtonText}>
                Add your first supplement
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Supplement cards */}
        {supplements.map((supp) => (
          <SupplementCard
            key={supp.id}
            supplement={supp}
            colors={colors}
            onLog={() => setQuickLogSupplement(supp)}
            onHistory={() => openHistory(supp)}
            onSettings={() => setSettingsSupplement(supp)}
            onDelete={() => handleDeleteSupplement(supp)}
          />
        ))}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Quick log sheet */}
      {quickLogSupplement && (
        <QuickLogSupplement
          visible={!!quickLogSupplement}
          onClose={() => setQuickLogSupplement(null)}
          onLog={(amount, note) => {
            void handleLog(quickLogSupplement, amount, note)
            setQuickLogSupplement(null)
          }}
          supplementName={quickLogSupplement.name}
          unit={quickLogSupplement.unit}
          icon={quickLogSupplement.icon || "💊"}
          defaultAmount={quickLogSupplement.defaultAmount}
          quickAmounts={
            [
              quickLogSupplement.defaultAmount * 0.5,
              quickLogSupplement.defaultAmount,
              quickLogSupplement.defaultAmount * 2,
            ].map(Math.round) as unknown as readonly number[]
          }
        />
      )}

      {/* Template picker sheet */}
      <ModalSheet
        visible={showTemplateSheet}
        onClose={() => setShowTemplateSheet(false)}
      >
        <Text style={styles.sheetTitle}>Add Supplement</Text>
        <Text style={styles.sheetSubtitle}>
          Pick a template or create your own
        </Text>

        <ScrollView
          style={{ maxHeight: 440 }}
          showsVerticalScrollIndicator={false}
        >
          {DEFAULT_SUPPLEMENT_TEMPLATES.map((t) => {
            const added = alreadyAdded(t)
            return (
              <TouchableOpacity
                key={t.name}
                style={[styles.templateRow, added && styles.templateRowAdded]}
                onPress={() => !added && handleAddFromTemplate(t)}
                disabled={added || saving}
              >
                <Text style={styles.templateIcon}>{t.icon}</Text>
                <View style={styles.templateInfo}>
                  <Text
                    style={[
                      styles.templateName,
                      added && styles.templateNameAdded,
                    ]}
                  >
                    {t.name}
                  </Text>
                  <Text style={styles.templateDesc}>{t.description}</Text>
                  <Text style={styles.templateAmount}>
                    Default: {t.defaultAmount} {t.unit}
                  </Text>
                </View>
                {added ? (
                  <Text style={styles.templateAddedBadge}>✓ Added</Text>
                ) : (
                  <Text style={styles.templateAddIcon}>+</Text>
                )}
              </TouchableOpacity>
            )
          })}
        </ScrollView>

        <TouchableOpacity
          style={styles.customButton}
          onPress={() => {
            setShowTemplateSheet(false)
            setShowAddSheet(true)
          }}
        >
          <Text style={styles.customButtonText}>
            ✏️ Create Custom Supplement
          </Text>
        </TouchableOpacity>
      </ModalSheet>

      {/* Custom supplement sheet */}
      <ModalSheet visible={showAddSheet} onClose={() => setShowAddSheet(false)}>
        <Text style={styles.sheetTitle}>Custom Supplement</Text>

        <View style={styles.formRow}>
          <TextInput
            style={[
              styles.formInput,
              { flex: 0, width: 60, textAlign: "center", fontSize: 28 },
            ]}
            value={newIcon}
            onChangeText={setNewIcon}
            placeholder='💊'
            maxLength={2}
          />
          <TextInput
            style={[styles.formInput, { flex: 1, marginLeft: 10 }]}
            value={newName}
            onChangeText={setNewName}
            placeholder='Supplement name'
            autoFocus
          />
        </View>

        <View style={styles.formRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.formLabel}>Default amount</Text>
            <TextInput
              style={styles.formInput}
              value={newAmount}
              onChangeText={setNewAmount}
              keyboardType='decimal-pad'
              placeholder='5'
            />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.formLabel}>Unit</Text>
            <TextInput
              style={styles.formInput}
              value={newUnit}
              onChangeText={setNewUnit}
              placeholder='g'
              autoCapitalize='none'
            />
          </View>
        </View>

        <View style={styles.sheetButtons}>
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => setShowAddSheet(false)}
          >
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleAddCustom}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color='#fff' />
            ) : (
              <Text style={styles.saveBtnText}>Add Supplement</Text>
            )}
          </TouchableOpacity>
        </View>
      </ModalSheet>

      {/* History sheet */}
      <ModalSheet
        visible={showHistorySheet}
        onClose={() => setShowHistorySheet(false)}
      >
        <Text style={styles.sheetTitle}>
          {historySupp?.icon || "💊"} {historySupp?.name} History
        </Text>
        <Text style={styles.sheetSubtitle}>Last 30 entries</Text>

        {historyLoading ? (
          <View style={{ paddingVertical: 40, alignItems: "center" }}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : history.length === 0 ? (
          <View style={styles.historyEmpty}>
            <Text style={styles.historyEmptyIcon}>📋</Text>
            <Text style={styles.historyEmptyText}>No entries yet</Text>
          </View>
        ) : (
          <ScrollView
            style={{ maxHeight: 420 }}
            showsVerticalScrollIndicator={false}
          >
            {history.map((entry) => (
              <View key={entry.id} style={styles.historyRow}>
                <View style={styles.historyInfo}>
                  <Text style={styles.historyAmount}>
                    {entry.amount} {historySupp?.unit}
                  </Text>
                  {entry.note ? (
                    <Text style={styles.historyNote}>{entry.note}</Text>
                  ) : null}
                  <Text style={styles.historyDate}>
                    {formatDate(entry.takenAt)}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleDeleteEntry(entry)}
                  style={styles.historyDelete}
                >
                  <Text style={styles.historyDeleteText}>🗑</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}
      </ModalSheet>

      {/* Per-supplement settings modal */}
      {settingsSupplement && (
        <SupplementSettingsModal
          visible={!!settingsSupplement}
          supplement={settingsSupplement}
          onClose={() => setSettingsSupplement(null)}
          onSaved={() => {
            setSettingsSupplement(null)
            void loadSupplements(true)
          }}
        />
      )}

      {AlertComponent}
    </SafeAreaView>
  )
}

// ─── Supplement Card ──────────────────────────────────────────────────────────

interface SupplementCardProps {
  supplement: SupplementSummary
  colors: ThemeColors
  onLog: () => void
  onHistory: () => void
  onSettings: () => void
  onDelete: () => void
}

function SupplementCard({
  supplement: s,
  colors,
  onLog,
  onHistory,
  onSettings,
  onDelete,
}: SupplementCardProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <View style={cardStyles(colors).card}>
      {/* Main row */}
      <TouchableOpacity
        style={cardStyles(colors).mainRow}
        onPress={() => setExpanded((v) => !v)}
        activeOpacity={0.8}
      >
        <View
          style={[
            cardStyles(colors).iconCircle,
            { backgroundColor: s.color ? `${s.color}22` : colors.accentLight },
          ]}
        >
          <Text style={cardStyles(colors).iconText}>{s.icon || "💊"}</Text>
        </View>

        <View style={cardStyles(colors).info}>
          <Text style={cardStyles(colors).name}>{s.name}</Text>
          <Text style={cardStyles(colors).meta}>
            {s.defaultAmount} {s.unit}
            {s.streak > 0 ? ` · 🔥 ${s.streak} day streak` : ""}
            {s.reminderEnabled ? " · ⏰ reminder on" : ""}
          </Text>
        </View>

        <View style={cardStyles(colors).rightSide}>
          {s.takenToday ? (
            <View style={cardStyles(colors).takenBadge}>
              <Text style={cardStyles(colors).takenText}>✓ Done</Text>
            </View>
          ) : (
            <TouchableOpacity style={cardStyles(colors).logBtn} onPress={onLog}>
              <Text style={cardStyles(colors).logBtnText}>Log</Text>
            </TouchableOpacity>
          )}
          <Text style={cardStyles(colors).chevron}>{expanded ? "▲" : "▼"}</Text>
        </View>
      </TouchableOpacity>

      {/* Expanded actions */}
      {expanded && (
        <View style={cardStyles(colors).actions}>
          {s.takenToday && (
            <TouchableOpacity
              style={cardStyles(colors).actionBtn}
              onPress={onLog}
            >
              <Text style={cardStyles(colors).actionIcon}>📝</Text>
              <Text style={cardStyles(colors).actionLabel}>Log Again</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={cardStyles(colors).actionBtn}
            onPress={onHistory}
          >
            <Text style={cardStyles(colors).actionIcon}>📋</Text>
            <Text style={cardStyles(colors).actionLabel}>History</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={cardStyles(colors).actionBtn}
            onPress={onSettings}
          >
            <Text style={cardStyles(colors).actionIcon}>⚙️</Text>
            <Text style={cardStyles(colors).actionLabel}>Settings</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={cardStyles(colors).actionBtn}
            onPress={onDelete}
          >
            <Text style={cardStyles(colors).actionIcon}>🗑</Text>
            <Text
              style={[cardStyles(colors).actionLabel, { color: colors.error }]}
            >
              Delete
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const cardStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      marginHorizontal: 16,
      marginBottom: 12,
      overflow: "hidden",
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 3,
    },
    mainRow: {
      flexDirection: "row",
      alignItems: "center",
      padding: 16,
      gap: 14,
    },
    iconCircle: {
      width: 50,
      height: 50,
      borderRadius: 25,
      alignItems: "center",
      justifyContent: "center",
    },
    iconText: { fontSize: 26 },
    info: { flex: 1 },
    name: {
      fontSize: 17,
      fontWeight: "700",
      color: colors.textPrimary,
      marginBottom: 3,
    },
    meta: { fontSize: 13, color: colors.textMuted },
    rightSide: { alignItems: "flex-end", gap: 6 },
    takenBadge: {
      backgroundColor: colors.successLight,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 20,
    },
    takenText: { fontSize: 12, fontWeight: "700", color: colors.success },
    logBtn: {
      backgroundColor: colors.accent,
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 20,
    },
    logBtnText: { fontSize: 13, fontWeight: "700", color: colors.surface },
    chevron: { fontSize: 11, color: colors.textMuted },
    actions: {
      flexDirection: "row",
      borderTopWidth: 1,
      borderTopColor: colors.separator,
    },
    actionBtn: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 12,
      gap: 4,
    },
    actionIcon: { fontSize: 18 },
    actionLabel: {
      fontSize: 11,
      color: colors.textSecondary,
      fontWeight: "600",
    },
  })

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { flex: 1 },
    scrollContent: { paddingTop: 4, paddingBottom: 20 },
    loadingContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 16,
    },
    loadingText: { fontSize: 16, color: colors.textMuted },

    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingVertical: 18,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: "800",
      color: colors.textPrimary,
    },
    headerSubtitle: { fontSize: 14, color: colors.textMuted, marginTop: 2 },
    addButton: {
      backgroundColor: colors.accent,
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 22,
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 6,
    },
    addButtonText: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.surface,
    },

    emptyState: {
      alignItems: "center",
      paddingHorizontal: 40,
      paddingVertical: 60,
    },
    emptyIcon: { fontSize: 64, marginBottom: 16 },
    emptyTitle: {
      fontSize: 22,
      fontWeight: "700",
      color: colors.textPrimary,
      marginBottom: 8,
    },
    emptySubtitle: {
      fontSize: 15,
      color: colors.textMuted,
      textAlign: "center",
      lineHeight: 22,
      marginBottom: 28,
    },
    emptyButton: {
      backgroundColor: colors.accent,
      paddingHorizontal: 24,
      paddingVertical: 14,
      borderRadius: 14,
    },
    emptyButtonText: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.surface,
    },

    sheetTitle: {
      fontSize: 22,
      fontWeight: "800",
      color: colors.textPrimary,
      marginBottom: 4,
    },
    sheetSubtitle: {
      fontSize: 14,
      color: colors.textMuted,
      marginBottom: 20,
    },

    templateRow: {
      flexDirection: "row",
      alignItems: "center",
      padding: 14,
      borderRadius: 14,
      backgroundColor: colors.inputBackground,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.inputBorder,
    },
    templateRowAdded: {
      opacity: 0.5,
    },
    templateIcon: { fontSize: 30, marginRight: 14 },
    templateInfo: { flex: 1 },
    templateName: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.textPrimary,
      marginBottom: 2,
    },
    templateNameAdded: { color: colors.textMuted },
    templateDesc: { fontSize: 13, color: colors.textSecondary },
    templateAmount: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    templateAddedBadge: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.success,
    },
    templateAddIcon: {
      fontSize: 24,
      fontWeight: "700",
      color: colors.accent,
    },

    customButton: {
      marginTop: 14,
      backgroundColor: colors.inputBackground,
      padding: 16,
      borderRadius: 14,
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.inputBorder,
    },
    customButtonText: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.textPrimary,
    },

    formLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.textSecondary,
      marginBottom: 6,
    },
    formRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      marginBottom: 14,
    },
    formInput: {
      backgroundColor: colors.inputBackground,
      borderRadius: 12,
      padding: 14,
      fontSize: 16,
      color: colors.textPrimary,
      borderWidth: 1,
      borderColor: colors.inputBorder,
    },

    sheetButtons: {
      flexDirection: "row",
      gap: 12,
      marginTop: 8,
    },
    cancelBtn: {
      flex: 1,
      backgroundColor: colors.separator,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: "center",
    },
    cancelBtnText: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.textSecondary,
    },
    saveBtn: {
      flex: 2,
      backgroundColor: colors.accent,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: "center",
    },
    saveBtnText: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.surface,
    },

    historyEmpty: {
      alignItems: "center",
      paddingVertical: 40,
    },
    historyEmptyIcon: { fontSize: 40, marginBottom: 10, opacity: 0.3 },
    historyEmptyText: { fontSize: 15, color: colors.textMuted },
    historyRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.separator,
    },
    historyInfo: { flex: 1 },
    historyAmount: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    historyNote: {
      fontSize: 13,
      color: colors.textSecondary,
      fontStyle: "italic",
      marginTop: 2,
    },
    historyDate: { fontSize: 12, color: colors.textMuted, marginTop: 3 },
    historyDelete: { padding: 8 },
    historyDeleteText: { fontSize: 18 },
  })
