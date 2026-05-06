import React, { useState, useEffect, useCallback, useMemo } from "react"
import {
  ScrollView,
  TouchableOpacity,
  Text,
  View,
  Modal,
  StyleSheet,
} from "react-native"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { useTheme } from "../context/ThemeContext"
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from "react-native-reanimated"
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler"

export interface TabItem {
  key: string
  icon: string
  label: string
}

interface TabConfig {
  key: string
  visible: boolean
}

interface Props {
  tabs: TabItem[]
  activeTab: string
  onTabChange: (tab: string) => void
  /** Optional badge counts keyed by tab key. A value > 0 shows a red dot. */
  badges?: Record<string, number>
  /** AsyncStorage key to persist order + visibility. Defaults to "scrollTabBar_config". */
  storageKey?: string
  containerStyle?: object
}

const ROW_HEIGHT = 68

// ─────────────────────────────────────────────────────────────────────────────
// DraggableRow
// ─────────────────────────────────────────────────────────────────────────────
interface RowProps {
  tab: TabItem
  cfg: TabConfig
  index: number
  total: number
  visibleCount: number
  accentLightColor: string
  surfaceColor: string
  onToggle: (key: string) => void
  onReorder: (from: number, to: number) => void
}

function DraggableRow({
  tab,
  cfg,
  index,
  total,
  visibleCount,
  accentLightColor,
  surfaceColor,
  onToggle,
  onReorder,
}: RowProps) {
  const { colors } = useTheme()
  const styles = rowStyles(colors)

  const translateY = useSharedValue(0)
  const active = useSharedValue(false)
  const svIndex = useSharedValue(index)
  const svTotal = useSharedValue(total)

  // Keep shared values in sync after render — never write .value during render
  useEffect(() => {
    svIndex.value = index
  }, [index])

  useEffect(() => {
    svTotal.value = total
  }, [total])

  const accentLight = accentLightColor
  const surface = surfaceColor

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .onStart(() => {
          "worklet"
          active.value = true
        })
        .onUpdate((e) => {
          "worklet"
          translateY.value = e.translationY
        })
        .onEnd((e) => {
          "worklet"
          const rawTarget =
            svIndex.value + Math.round(e.translationY / ROW_HEIGHT)
          const target = Math.max(0, Math.min(rawTarget, svTotal.value - 1))
          translateY.value = withSpring(0, { damping: 20, stiffness: 200 })
          active.value = false
          if (target !== svIndex.value) {
            runOnJS(onReorder)(svIndex.value, target)
          }
        })
        .onFinalize(() => {
          "worklet"
          translateY.value = withTiming(0, { duration: 150 })
          active.value = false
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onReorder],
  )

  const animStyle = useAnimatedStyle(() => {
    "worklet"
    return {
      transform: [{ translateY: translateY.value }],
      zIndex: active.value ? 100 : 1,
      shadowOpacity: withTiming(active.value ? 0.22 : 0, { duration: 150 }),
      shadowRadius: withTiming(active.value ? 10 : 0, { duration: 150 }),
      elevation: active.value ? 8 : 1,
      backgroundColor: active.value ? accentLight : surface,
    }
  })

  const canHide = cfg.visible ? visibleCount > 1 : true

  return (
    <Animated.View style={[styles.row, animStyle]}>
      <GestureDetector gesture={pan}>
        <View style={styles.handle}>
          <Text style={styles.handleIcon}>☰</Text>
        </View>
      </GestureDetector>

      <View style={[styles.preview, !cfg.visible && styles.previewHidden]}>
        <Text style={styles.previewIcon}>{tab.icon}</Text>
        <Text
          style={[
            styles.previewLabel,
            !cfg.visible && styles.previewLabelHidden,
          ]}
        >
          {tab.label}
        </Text>
      </View>

      <TouchableOpacity
        onPress={() => canHide && onToggle(cfg.key)}
        style={[
          styles.pill,
          cfg.visible ? styles.pillOn : styles.pillOff,
          !canHide && styles.pillDisabled,
        ]}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text
          style={[
            styles.pillText,
            cfg.visible ? styles.pillTextOn : styles.pillTextOff,
          ]}
        >
          {cfg.visible ? "Visible" : "Hidden"}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
export default function ScrollTabBar({
  tabs,
  activeTab,
  onTabChange,
  badges = {},
  storageKey = "scrollTabBar_config",
  containerStyle,
}: Props) {
  const { colors } = useTheme()
  const styles = makeStyles(colors)

  const [config, setConfig] = useState<TabConfig[]>(
    tabs.map((t) => ({ key: t.key, visible: true })),
  )
  const [showEditor, setShowEditor] = useState(false)

  // ── Persistence ────────────────────────────────────────────────────────────
  useEffect(() => {
    ;(async () => {
      try {
        const raw = await AsyncStorage.getItem(storageKey)
        if (!raw) return
        const saved: TabConfig[] = JSON.parse(raw)
        const knownKeys = new Set(saved.map((c) => c.key))
        const merged: TabConfig[] = [
          ...saved.filter((c) => tabs.some((t) => t.key === c.key)),
          ...tabs
            .filter((t) => !knownKeys.has(t.key))
            .map((t) => ({ key: t.key, visible: true })),
        ]
        setConfig(merged)
      } catch {}
    })()
  }, [storageKey])

  const persist = (next: TabConfig[]) => {
    AsyncStorage.setItem(storageKey, JSON.stringify(next)).catch(() => {})
  }

  // ── Reorder ────────────────────────────────────────────────────────────────
  const handleReorder = useCallback((from: number, to: number) => {
    setConfig((prev) => {
      const next = [...prev]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      persist(next)
      return next
    })
  }, [])

  // ── Visibility ─────────────────────────────────────────────────────────────
  const toggleVisible = useCallback(
    (key: string) => {
      setConfig((prev) => {
        const next = prev.map((c) =>
          c.key === key ? { ...c, visible: !c.visible } : c,
        )
        if (next.filter((c) => c.visible).length === 0) return prev
        if (key === activeTab) {
          const first = next.find((c) => c.visible)
          if (first) onTabChange(first.key)
        }
        persist(next)
        return next
      })
    },
    [activeTab, onTabChange],
  )

  const reset = useCallback(() => {
    const next = tabs.map((t) => ({ key: t.key, visible: true }))
    setConfig(next)
    persist(next)
  }, [tabs])

  // ── Derived ────────────────────────────────────────────────────────────────
  const tabMap = new Map(tabs.map((t) => [t.key, t]))
  const visibleTabs = config
    .filter((c) => c.visible)
    .map((c) => tabMap.get(c.key))
    .filter(Boolean) as TabItem[]
  const visibleCount = config.filter((c) => c.visible).length

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.scroll, containerStyle]}
        contentContainerStyle={styles.scrollContent}
      >
        {visibleTabs.map((tab) => {
          const badgeCount = badges[tab.key] ?? 0
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.tabActive]}
              onPress={() => onTabChange(tab.key)}
            >
              <Text style={styles.tabIcon}>{tab.icon}</Text>
              <Text
                style={[
                  styles.tabLabel,
                  activeTab === tab.key && styles.tabLabelActive,
                ]}
              >
                {tab.label}
              </Text>
              {badgeCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{badgeCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          )
        })}

        {/* ⋯ always last in the scroll */}
        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => setShowEditor(true)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.editBtnText}>⋯</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={showEditor}
        animationType='slide'
        presentationStyle='pageSheet'
        onRequestClose={() => setShowEditor(false)}
      >
        <GestureHandlerRootView style={{ flex: 1 }}>
          <View style={styles.editorContainer}>
            <View style={styles.editorHeader}>
              <Text style={styles.editorTitle}>Customize Tabs</Text>
              <TouchableOpacity
                style={styles.doneBtn}
                onPress={() => setShowEditor(false)}
              >
                <Text style={styles.doneBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.editorSubtitle}>
              Drag ☰ to reorder · tap to toggle visibility
            </Text>

            <ScrollView
              style={styles.editorList}
              contentContainerStyle={styles.editorListContent}
            >
              {config.map((c, index) => {
                const tab = tabMap.get(c.key)
                if (!tab) return null
                return (
                  <DraggableRow
                    key={c.key}
                    tab={tab}
                    cfg={c}
                    index={index}
                    total={config.length}
                    visibleCount={visibleCount}
                    accentLightColor={colors.accentLight as string}
                    surfaceColor={colors.surface as string}
                    onToggle={toggleVisible}
                    onReorder={handleReorder}
                  />
                )
              })}
            </ScrollView>

            <TouchableOpacity style={styles.resetBtn} onPress={reset}>
              <Text style={styles.resetBtnText}>Reset to Default</Text>
            </TouchableOpacity>
          </View>
        </GestureHandlerRootView>
      </Modal>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const rowStyles = (colors: any) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 14,
      paddingVertical: 14,
      paddingHorizontal: 14,
      marginBottom: 10,
      gap: 12,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 3 },
    },
    handle: {
      width: 36,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 8,
      backgroundColor: colors.inputBackground,
    },
    handleIcon: { fontSize: 16, color: colors.textSecondary },
    preview: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
    previewHidden: { opacity: 0.35 },
    previewIcon: { fontSize: 24 },
    previewLabel: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.textPrimary,
    },
    previewLabelHidden: { color: colors.textMuted },
    pill: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1.5,
    },
    pillOn: { backgroundColor: colors.accentLight, borderColor: colors.accent },
    pillOff: {
      backgroundColor: colors.inputBackground,
      borderColor: colors.surfaceBorder,
    },
    pillDisabled: { opacity: 0.4 },
    pillText: { fontSize: 12, fontWeight: "700" },
    pillTextOn: { color: colors.accent },
    pillTextOff: { color: colors.textMuted },
  })

const makeStyles = (colors: any) =>
  StyleSheet.create({
    scroll: { marginBottom: 20 },
    scrollContent: { paddingRight: 4, alignItems: "center" },
    tab: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingVertical: 12,
      marginRight: 10,
      borderRadius: 12,
      backgroundColor: colors.surface,
      position: "relative",
    },
    tabActive: { backgroundColor: colors.accent },
    tabIcon: { fontSize: 20, marginRight: 8 },
    tabLabel: { fontSize: 14, fontWeight: "600", color: colors.textSecondary },
    tabLabelActive: { color: colors.surface },
    badge: {
      position: "absolute",
      top: -4,
      right: -4,
      backgroundColor: colors.error,
      borderRadius: 10,
      minWidth: 20,
      height: 20,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 5,
    },
    badgeText: {
      color: colors.surface,
      fontSize: 11,
      fontWeight: "bold",
    },
    editBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 4,
    },
    editBtnText: { fontSize: 20, color: colors.textMuted, lineHeight: 22 },
    editorContainer: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: 20,
    },
    editorHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingBottom: 4,
    },
    editorTitle: { fontSize: 22, fontWeight: "700", color: colors.textPrimary },
    doneBtn: {
      backgroundColor: colors.accent,
      paddingHorizontal: 18,
      paddingVertical: 8,
      borderRadius: 10,
    },
    doneBtnText: { color: colors.surface, fontWeight: "700", fontSize: 15 },
    editorSubtitle: {
      fontSize: 13,
      color: colors.textMuted,
      paddingHorizontal: 20,
      marginBottom: 20,
      marginTop: 6,
    },
    editorList: { flex: 1, paddingHorizontal: 20 },
    editorListContent: { paddingBottom: 20 },
    resetBtn: {
      margin: 20,
      marginTop: 4,
      paddingVertical: 14,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: colors.surfaceBorder,
      alignItems: "center",
    },
    resetBtnText: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.textSecondary,
    },
  })
