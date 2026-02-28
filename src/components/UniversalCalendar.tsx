import React, { useState, useMemo } from "react"
import { View, Text, TouchableOpacity, StyleSheet } from "react-native"

// ─── Types ────────────────────────────────────────────────────────────────────

type CalendarView = "week" | "month"

interface UniversalCalendarProps {
  hasDataOnDate?: (date: Date) => boolean
  onDatePress?: (date: Date) => void
  initialView?: CalendarView
  legendText?: string
  dotColor?: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getWeekDates(anchorDate: Date): Date[] {
  const d = new Date(anchorDate)
  const dayOfWeek = d.getDay()
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const monday = new Date(d)
  monday.setDate(d.getDate() + mondayOffset)
  monday.setHours(0, 0, 0, 0)
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday)
    day.setDate(monday.getDate() + i)
    return day
  })
}

function getMonthGrid(anchorDate: Date): Array<Date | null> {
  const year = anchorDate.getFullYear()
  const month = anchorDate.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startOffset = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1
  const days: Array<Date | null> = []
  for (let i = 0; i < startOffset; i++) days.push(null)
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push(new Date(year, month, d))
  }
  while (days.length % 7 !== 0) days.push(null)
  return days
}

function toLocalDateStr(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return toLocalDateStr(a) === toLocalDateStr(b)
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function UniversalCalendar({
  hasDataOnDate,
  onDatePress,
  initialView = "week",
  legendText = "Data logged",
  dotColor = "#667eea",
}: UniversalCalendarProps) {
  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const [view, setView] = useState<CalendarView>(initialView)
  const [anchorDate, setAnchorDate] = useState<Date>(today)

  const navigate = (direction: -1 | 1) => {
    const d = new Date(anchorDate)
    if (view === "week") {
      d.setDate(d.getDate() + direction * 7)
    } else {
      d.setMonth(d.getMonth() + direction)
      d.setDate(1)
    }
    setAnchorDate(d)
  }

  const headerLabel = useMemo(() => {
    if (view === "week") {
      const days = getWeekDates(anchorDate)
      const first = days[0]!
      const last = days[6]!
      if (first.getMonth() === last.getMonth()) {
        return `${MONTH_NAMES[first.getMonth()]} ${first.getFullYear()}`
      }
      return `${MONTH_NAMES[first.getMonth()]!.slice(0, 3)} – ${MONTH_NAMES[last.getMonth()]!.slice(0, 3)} ${last.getFullYear()}`
    }
    return `${MONTH_NAMES[anchorDate.getMonth()]} ${anchorDate.getFullYear()}`
  }, [view, anchorDate])

  const weekDates = useMemo(() => getWeekDates(anchorDate), [anchorDate])
  const monthGrid = useMemo(() => getMonthGrid(anchorDate), [anchorDate])

  /**
   * Render a single calendar cell.
   * `gridIndex` is used to produce stable keys for empty (null) cells so that
   * React does not remount them on every render (previously Math.random() was
   * used which caused unnecessary unmount/mount cycles).
   */
  const renderDay = (date: Date | null, compact: boolean, gridIndex: number) => {
    if (!date) {
      return (
        <View
          key={`empty-${gridIndex}`}
          style={compact ? styles.monthCell : styles.weekCell}
        />
      )
    }

    const isToday = isSameLocalDay(date, today)
    const hasData = hasDataOnDate ? hasDataOnDate(date) : false
    const isFuture = date > today && !isToday

    const dayNumber = date.getDate()
    const dayName = DAY_NAMES[date.getDay()]!

    return (
      <TouchableOpacity
        key={toLocalDateStr(date)}
        style={[
          compact ? styles.monthCell : styles.weekCell,
          isToday && styles.todayCell,
          isFuture && styles.futureCell,
        ]}
        onPress={() => !isFuture && onDatePress?.(date)}
        disabled={isFuture}
        activeOpacity={isFuture ? 1 : 0.7}
      >
        {!compact && (
          <Text
            style={[
              styles.dayName,
              isToday && styles.todayText,
              isFuture && styles.futureText,
            ]}
          >
            {dayName}
          </Text>
        )}
        {compact && (
          <Text
            style={[
              styles.monthDayName,
              isToday && styles.todayText,
              isFuture && styles.futureText,
            ]}
          >
            {dayName.slice(0, 1)}
          </Text>
        )}
        <Text
          style={[
            compact ? styles.monthDayNumber : styles.dayNumber,
            isToday && styles.todayText,
            isFuture && styles.futureText,
          ]}
        >
          {dayNumber}
        </Text>
        {hasData ? (
          <View style={[styles.dot, { backgroundColor: dotColor }]} />
        ) : (
          <View style={styles.dotPlaceholder} />
        )}
      </TouchableOpacity>
    )
  }

  return (
    <View style={styles.container}>
      {/* Nav row */}
      <View style={styles.navRow}>
        <TouchableOpacity style={styles.navBtn} onPress={() => navigate(-1)}>
          <Text style={styles.navBtnText}>‹</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setAnchorDate(today)}
          style={styles.headerLabelBtn}
        >
          <Text style={styles.headerLabel}>{headerLabel}</Text>
          {!isSameLocalDay(anchorDate, today) && (
            <Text style={styles.todayLink}>Today</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.navBtn} onPress={() => navigate(1)}>
          <Text style={styles.navBtnText}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.viewToggle}
          onPress={() => setView((v) => (v === "week" ? "month" : "week"))}
        >
          <Text style={styles.viewToggleText}>
            {view === "week" ? "Month" : "Week"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Week view */}
      {view === "week" && (
        <View style={styles.weekRow}>
          {weekDates.map((d, i) => renderDay(d, false, i))}
        </View>
      )}

      {/* Month view */}
      {view === "month" && (
        <>
          <View style={styles.monthHeader}>
            {(["M", "T", "W", "T", "F", "S", "S"] as const).map((l, i) => (
              <Text key={i} style={styles.monthHeaderCell}>
                {l}
              </Text>
            ))}
          </View>
          {Array.from({ length: monthGrid.length / 7 }, (_, row) => (
            <View key={row} style={styles.monthRow}>
              {monthGrid
                .slice(row * 7, row * 7 + 7)
                .map((d, col) => renderDay(d, true, row * 7 + col))}
            </View>
          ))}
        </>
      )}

      {/* Legend */}
      <View style={styles.footer}>
        <View style={styles.legend}>
          <View style={[styles.legendDot, { backgroundColor: dotColor }]} />
          <Text style={styles.legendText}>{legendText}</Text>
        </View>
      </View>
    </View>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 15,
  },
  navRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  navBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  navBtnText: { fontSize: 22, color: "#555", lineHeight: 26 },
  headerLabelBtn: { flex: 1, alignItems: "center" },
  headerLabel: { fontSize: 15, fontWeight: "700", color: "#333" },
  todayLink: { fontSize: 11, color: "#667eea", marginTop: 1 },
  viewToggle: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "#f0f3ff",
    marginLeft: 6,
  },
  viewToggleText: { fontSize: 12, color: "#667eea", fontWeight: "600" },
  weekRow: { flexDirection: "row", justifyContent: "space-between" },
  weekCell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 6,
    borderRadius: 10,
    marginHorizontal: 1,
  },
  dayName: { fontSize: 11, color: "#999", marginBottom: 3 },
  dayNumber: { fontSize: 16, fontWeight: "700", color: "#333" },
  monthHeader: { flexDirection: "row", marginBottom: 2 },
  monthHeaderCell: {
    flex: 1,
    textAlign: "center",
    fontSize: 11,
    color: "#aaa",
    fontWeight: "600",
    paddingVertical: 2,
  },
  monthRow: { flexDirection: "row" },
  monthCell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 4,
    borderRadius: 8,
    marginVertical: 1,
    marginHorizontal: 0.5,
  },
  monthDayName: { fontSize: 9, color: "#bbb" },
  monthDayNumber: { fontSize: 13, fontWeight: "600", color: "#333" },
  todayCell: { backgroundColor: "#667eea15" },
  futureCell: { opacity: 0.35 },
  todayText: { color: "#667eea" },
  futureText: { color: "#bbb" },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 3 },
  dotPlaceholder: { width: 6, height: 6, marginTop: 3 },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  legend: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: "#999" },
})
