import React, { useState, useEffect, useCallback } from "react"
import type { User } from "../context/AuthContext"
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Image,
  Dimensions,
  ActivityIndicator,
  Switch,
  Platform,
  RefreshControl,
  StatusBar,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import AsyncStorage from "@react-native-async-storage/async-storage"
import * as ImagePicker from "expo-image-picker"
import * as Location from "expo-location"
import * as Notifications from "expo-notifications"
import * as FileSystem from "expo-file-system/legacy"
import { useAuth } from "../context/AuthContext"
import {
  bodyTrackingApi,
  macrosTrackingApi,
  bodyFatApi,
  creatineApi,
} from "../services/api"
import UniversalCalendar from "../components/UniversalCalendar"
import CreatineLocationPicker from "../components/CreatineLocationPicker"
import QuickLogCreatine from "../components/QuickLogCreatine"
import ProgressChart from "../components/ProgressChart"
import ModalSheet from "../components/ModalSheet"
import { useAlert } from "../components/CustomAlert"

const { width, height: SCREEN_HEIGHT } = Dimensions.get("window")

export async function getCurrentBodyWeight(userId: string | number): Promise<number | null> {
  try {
    const weightData: any = await bodyTrackingApi.getWeightHistory()
    const weightEntries = weightData.entries || []
    if (weightEntries.length > 0) {
      const validWeightEntries = weightEntries
        .map((e: any) => ({ ...e, weight_kg: parseFloat(e.weight_kg) }))
        .filter((e: any) => !isNaN(e.weight_kg) && e.weight_kg > 0)
        .sort((a: any, b: any) => (new Date(b.recorded_at) as any) - (new Date(a.recorded_at) as any))
      if (validWeightEntries.length > 0) return validWeightEntries[0].weight_kg
    }
    return null
  } catch (error) {
    console.error("Error getting current body weight:", error)
    return null
  }
}

const LOCATION_TASK_NAME = "creatine-location-reminder"

export default function TrackingScreen(): React.JSX.Element {
  const { user, authToken } = useAuth()
  const { alert, AlertComponent } = useAlert()

  const [loading, setLoading] = useState<boolean>(true)
  const [refreshing, setRefreshing] = useState<boolean>(false)
  const [activeTab, setActiveTab] = useState<string>("weight")

  // ─────────────────────────────────────────────────────────────
  // WEIGHT TRACKING
  // ─────────────────────────────────────────────────────────────
  const [weightHistory, setWeightHistory] = useState<any[]>([])
  const [weightUnit, setWeightUnit] = useState<string>("kg")
  const [showWeightModal, setShowWeightModal] = useState<boolean>(false)
  const [newWeight, setNewWeight] = useState<string>("")
  const [weightGoal, setWeightGoal] = useState<number | null>(null)
  const [showGoalModal, setShowGoalModal] = useState<boolean>(false)
  const [goalInputValue, setGoalInputValue] = useState<string>("")
  const [weightEntriesShown, setWeightEntriesShown] = useState<number>(10)
  const [trendAverageDays, setTrendAverageDays] = useState<number>(7)

  // ─────────────────────────────────────────────────────────────
  // UNIFIED DAY MODAL
  // ─────────────────────────────────────────────────────────────
  const [dayModal, setDayModal] = useState<any>(null)

  // Past-day weight
  const [pastWeight, setPastWeight] = useState<string>("")
  // Past-day creatine
  const [pastCreatineGrams, setPastCreatineGrams] = useState<string>("5")
  const [pastCreatineTime, setPastCreatineTime] = useState<string>("09:00")
  // Past-day macros
  const [pastMacrosName, setPastMacrosName] = useState<string>("")
  const [pastMacrosProtein, setPastMacrosProtein] = useState<string>("")
  const [pastMacrosCarbs, setPastMacrosCarbs] = useState<string>("")
  const [pastMacrosFat, setPastMacrosFat] = useState<string>("")
  const [pastMacrosCalories, setPastMacrosCalories] = useState<string>("")
  const [pastMacrosTime, setPastMacrosTime] = useState<string>("12:00")
  const [pastMacrosError, setPastMacrosError] = useState<string>("5")
  // Past-day body fat
  const [pastWaist, setPastWaist] = useState<string>("")
  const [pastNeck, setPastNeck] = useState<string>("")
  const [pastHip, setPastHip] = useState<string>("")
  const [pastMeasurementUnit, setPastMeasurementUnit] = useState<string>("cm")
  const [pastGender, setPastGender] = useState<string>("male")
  const [dayModalShowAddForm, setDayModalShowAddForm] = useState<boolean>(false)

  // ─────────────────────────────────────────────────────────────
  // HEIGHT
  // ─────────────────────────────────────────────────────────────
  const [height, setHeight] = useState<any>(null)
  const [heightUnit, setHeightUnit] = useState<string>("cm")
  const [showHeightModal, setShowHeightModal] = useState<boolean>(false)
  const [newHeightCm, setNewHeightCm] = useState<string>("")
  const [newHeightFt, setNewHeightFt] = useState<string>("")
  const [newHeightIn, setNewHeightIn] = useState<string>("")

  // ─────────────────────────────────────────────────────────────
  // CREATINE
  // ─────────────────────────────────────────────────────────────
  const [creatineEnabled, setCreatineEnabled] = useState<boolean>(false)
  const [creatineTime, setCreatineTime] = useState<string>("09:00")
  const [creatineTakenToday, setCreatineTakenToday] = useState<boolean>(false)
  const [creatineStreak, setCreatineStreak] = useState<number>(0)
  const [creatineHistory, setCreatineHistory] = useState<any[]>([])
  const [showCreatineModal, setShowCreatineModal] = useState<boolean>(false)
  const [creatineGrams, setCreatineGrams] = useState<string>("5")
  const [defaultCreatineGrams, setDefaultCreatineGrams] = useState<number>(5)
  const [locationBasedReminder, setLocationBasedReminder] = useState<boolean>(false)
  const [reminderLocation, setReminderLocation] = useState<any>(null)
  const [showLocationPicker, setShowLocationPicker] = useState<boolean>(false)

  // ─────────────────────────────────────────────────────────────
  // PROGRESS PHOTOS
  // ─────────────────────────────────────────────────────────────
  const [progressPhotos, setProgressPhotos] = useState<any[]>([])
  const [selectedPhoto, setSelectedPhoto] = useState<any>(null)
  const [showPhotoModal, setShowPhotoModal] = useState<boolean>(false)
  const [photoUriCache, setPhotoUriCache] = useState<Record<string, string>>({})
  const [photoUriLoading, setPhotoUriLoading] = useState<Record<string, boolean>>({})
  const [selectedDatePhotos, setSelectedDatePhotos] = useState<any>(null)
  const [showDatePhotosModal, setShowDatePhotosModal] = useState<boolean>(false)
  const [expandedPhoto, setExpandedPhoto] = useState<any>(null)

  // ─────────────────────────────────────────────────────────────
  // MACROS TRACKING
  // ─────────────────────────────────────────────────────────────
  const [macrosEntries, setMacrosEntries] = useState<any[]>([])
  const [dailyMacrosGoals, setDailyMacrosGoals] = useState({
    protein: 150,
    carbs: 250,
    fat: 65,
    calories: 2000,
  })
  const [showMacrosModal, setShowMacrosModal] = useState<boolean>(false)
  const [newMacrosProtein, setNewMacrosProtein] = useState("")
  const [newMacrosCarbs, setNewMacrosCarbs] = useState("")
  const [newMacrosFat, setNewMacrosFat] = useState("")
  const [newMacrosCalories, setNewMacrosCalories] = useState("")
  const [newMacrosTime, setNewMacrosTime] = useState(
    new Date().toTimeString().slice(0, 5),
  )
  const [newMacrosError, setNewMacrosError] = useState("5")
  const [showMacrosGoalModal, setShowMacrosGoalModal] = useState<boolean>(false)
  const [macrosGoalInput, setMacrosGoalInput] = useState({
    protein: "",
    carbs: "",
    fat: "",
    calories: "",
  })
  const [selectedDateMacros, setSelectedDateMacros] = useState(null)
  const [showDateMacrosModal, setShowDateMacrosModal] = useState(false)

  // ─────────────────────────────────────────────────────────────
  // BODY FAT
  // ─────────────────────────────────────────────────────────────
  const [bodyFatHistory, setBodyFatHistory] = useState<any[]>([])
  const [showBodyFatModal, setShowBodyFatModal] = useState<boolean>(false)
  const [gender, setGender] = useState("male")
  const [waist, setWaist] = useState("")
  const [neck, setNeck] = useState("")
  const [hip, setHip] = useState("")
  const [measurementUnit, setMeasurementUnit] = useState("cm")
  const [selectedDateBodyFat, setSelectedDateBodyFat] = useState(null)
  const [showDateBodyFatModal, setShowDateBodyFatModal] = useState(false)
  const [newMacrosName, setNewMacrosName] = useState("")
  const [showQuickLogCreatine, setShowQuickLogCreatine] = useState(false)

  // ─────────────────────────────────────────────────────────────
  // SELECTED LOG DATE
  // ─────────────────────────────────────────────────────────────
  const [selectedLogDate, setSelectedLogDate] = useState(null)

  const getUserKey = (key: any) => (user?.id ? `${key}_user_${user.id}` : key)

  // ─────────────────────────────────────────────────────────────
  // DATE HELPERS
  // ─────────────────────────────────────────────────────────────
  const toLocalDateStr = (date: any) => {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, "0")
    const d = String(date.getDate()).padStart(2, "0")
    return `${y}-${m}-${d}`
  }

  const isoToLocalDateStr = (isoStr: any) => {
    if (!isoStr) return ""
    if (/^\d{4}-\d{2}-\d{2}$/.test(isoStr)) return isoStr
    const d = new Date(isoStr)
    if (isNaN(d.getTime())) return ""
    return toLocalDateStr(d)
  }

  const buildLocalISOForDate = (date: any, timeStr = "09:00") => {
    const dateStr = toLocalDateStr(date)
    return `${dateStr}T${timeStr}:00`
  }

  // ─────────────────────────────────────────────────────────────
  // RESET FIELDS
  // ─────────────────────────────────────────────────────────────
  const resetDayModalFields = () => {
    setPastWeight("")
    setPastCreatineGrams(String(defaultCreatineGrams))
    setPastCreatineTime("09:00")
    setPastMacrosName("")
    setPastMacrosProtein("")
    setPastMacrosCarbs("")
    setPastMacrosFat("")
    setPastMacrosCalories("")
    setPastMacrosTime("12:00")
    setPastMacrosError("5")
    setPastWaist("")
    setPastNeck("")
    setPastHip("")
    setPastGender(gender)
    setPastMeasurementUnit(measurementUnit)
    setDayModalShowAddForm(false)
  }

  // ─────────────────────────────────────────────────────────────
  // UNIFIED CALENDAR DATE PRESS
  // ─────────────────────────────────────────────────────────────
  const handleCalendarDatePress = (date: any, tab: any) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const pressedDate = new Date(date)
    pressedDate.setHours(0, 0, 0, 0)
    const isToday = pressedDate.getTime() === today.getTime()

    resetDayModalFields()
    setSelectedLogDate(date)

    const dateStr = toLocalDateStr(date)
    let existingEntries = null

    if (tab === "weight") {
      const entries = weightHistory.filter(
        (e) => isoToLocalDateStr(e?.recorded_at) === dateStr,
      )
      if (entries.length > 0) existingEntries = entries
    }

    if (tab === "creatine") {
      const entries = creatineHistory.filter((c: any) => {
        const d = c?.taken_at || c?.date
        return isoToLocalDateStr(d) === dateStr
      })
      if (entries.length > 0) existingEntries = entries
    }

    if (tab === "macros") {
      const stats = getDailyMacrosStats(date)
      if (stats) existingEntries = stats.entriesList
    }

    if (tab === "photos") {
      const photos = getPhotosForDate(date)
      if (photos.length > 0) {
        existingEntries = photos
        prefetchPhotosForDate(photos)
      }
    }

    if (tab === "bodyfat") {
      const entry = bodyFatHistory.find(
        (b: any) => isoToLocalDateStr(b?.date) === dateStr,
      )
      if (entry) existingEntries = [entry]
    }

    setDayModalShowAddForm(existingEntries === null)
    setDayModal({ date, tab, existingEntries, isToday })
  }

  // ─────────────────────────────────────────────────────────────
  // OPEN LOG MODAL FOR TAB
  // ─────────────────────────────────────────────────────────────
  const openLogModalForTab = (tab: any) => {
    setDayModal(null)
    switch (tab) {
      case "weight":
        setNewWeight("")
        setShowWeightModal(true)
        break
      case "creatine":
        setShowQuickLogCreatine(true)
        break
      case "macros":
        setNewMacrosName("")
        setNewMacrosProtein("")
        setNewMacrosCarbs("")
        setNewMacrosFat("")
        setNewMacrosCalories("")
        setNewMacrosError("5")
        setNewMacrosTime(new Date().toTimeString().slice(0, 5))
        setShowMacrosModal(true)
        break
      case "photos":
        alert(
          "Add Photo",
          "Choose a source",
          [
            { text: "Camera", onPress: takePhoto },
            { text: "Gallery", onPress: pickPhotoFromGallery },
            { text: "Cancel", style: "cancel" },
          ],
          "info",
        )
        break
      case "bodyfat":
        setWaist("")
        setNeck("")
        setHip("")
        setShowBodyFatModal(true)
        break
    }
  }

  // ─────────────────────────────────────────────────────────────
  // DELETE HANDLERS
  // ─────────────────────────────────────────────────────────────
  const deleteWeightEntry = (entry: any) => {
    const label =
      weightUnit === "kg"
        ? `${entry.weight_kg.toFixed(1)} kg`
        : `${(entry.weight_kg * 2.20462).toFixed(1)} lbs`
    alert(
      "Delete Entry",
      `Remove ${label}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await bodyTrackingApi.deleteWeightEntry(entry.id)
              setWeightHistory((prev: any) => prev.filter((e: any) => e.id !== entry.id))
              setDayModal((prev: any) => {
                if (!prev) return null
                const remaining = (prev.existingEntries || []).filter(
                  (e: any) => e.id !== entry.id,
                )
                return {
                  ...prev,
                  existingEntries: remaining.length > 0 ? remaining : null,
                }
              })
            } catch (err: any) {
              alert("Error", err.message, [{ text: "OK" }], "error")
            }
          },
        },
      ],
      "warning",
    )
  }

  const deleteCreatineEntry = (entry: any) => {
    alert(
      "Delete Entry",
      "Remove this creatine log?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await bodyTrackingApi.deleteCreatineEntry(entry.id)
              setCreatineHistory((prev: any) =>
                prev.filter((c: any) => c.id !== entry.id),
              )
              setDayModal((prev: any) => {
                if (!prev) return null
                const remaining = (prev.existingEntries || []).filter(
                  (e: any) => e.id !== entry.id,
                )
                return {
                  ...prev,
                  existingEntries: remaining.length > 0 ? remaining : null,
                }
              })
              const entryDate = isoToLocalDateStr(entry.taken_at || entry.date)
              if (entryDate === toLocalDateStr(new Date()))
                setCreatineTakenToday(false)
              loadData()
            } catch (err: any) {
              alert("Error", err.message, [{ text: "OK" }], "error")
            }
          },
        },
      ],
      "warning",
    )
  }

  const deleteMacroEntry = (entry: any) => {
    alert(
      "Delete Entry",
      entry.name ? `Remove "${entry.name}"?` : "Remove this entry?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await macrosTrackingApi.deleteMacrosEntry(entry.id)
              setMacrosEntries((prev: any) => prev.filter((e: any) => e.id !== entry.id))
              setDayModal((prev: any) => {
                if (!prev) return null
                const remaining = (prev.existingEntries || []).filter(
                  (e: any) => e.id !== entry.id,
                )
                return {
                  ...prev,
                  existingEntries: remaining.length > 0 ? remaining : null,
                }
              })
              loadData()
            } catch (err: any) {
              alert("Error", err.message, [{ text: "OK" }], "error")
            }
          },
        },
      ],
      "warning",
    )
  }

  const deletePhoto = (photo: any) => {
    alert(
      "Delete Photo",
      "Permanently delete this progress photo?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await bodyTrackingApi.deleteProgressPhoto(photo.id)
              setProgressPhotos((prev: any) => prev.filter((p: any) => p.id !== photo.id))
              setPhotoUriCache((prev: any) => {
                const next = { ...prev }
                delete next[photo.id]
                return next
              })
              setDayModal((prev: any) => {
                if (!prev) return null
                const remaining = (prev.existingEntries || []).filter(
                  (p: any) => p.id !== photo.id,
                )
                return {
                  ...prev,
                  existingEntries: remaining.length > 0 ? remaining : null,
                }
              })
              setSelectedDatePhotos((prev: any) => {
                if (!prev) return null
                const remaining = prev.photos.filter((p: any) => p.id !== photo.id)
                return remaining.length > 0
                  ? { ...prev, photos: remaining }
                  : null
              })
              if (
                !selectedDatePhotos ||
                selectedDatePhotos.photos.filter((p: any) => p.id !== photo.id)
                  .length === 0
              ) {
                setShowDatePhotosModal(false)
              }
            } catch (err: any) {
              alert("Error", err.message, [{ text: "OK" }], "error")
            }
          },
        },
      ],
      "warning",
    )
  }

  const deleteBodyFatEntry = (entry: any) => {
    alert(
      "Delete Entry",
      `Remove ${entry.percentage}% reading?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await bodyFatApi.deleteBodyFatEntry(entry.id)
              setBodyFatHistory((prev: any) => prev.filter((b: any) => b.id !== entry.id))
              setDayModal((prev: any) => {
                if (!prev) return null
                const remaining = (prev.existingEntries || []).filter(
                  (b: any) => b.id !== entry.id,
                )
                return {
                  ...prev,
                  existingEntries: remaining.length > 0 ? remaining : null,
                }
              })
            } catch (err: any) {
              alert("Error", err.message, [{ text: "OK" }], "error")
            }
          },
        },
      ],
      "warning",
    )
  }

  // ─────────────────────────────────────────────────────────────
  // SUBMIT PAST DAY ENTRY
  // ─────────────────────────────────────────────────────────────
  const submitPastDayEntry = async () => {
    if (!dayModal) return
    const { date, tab } = dayModal

    try {
      if (tab === "weight") {
        if (!pastWeight || isNaN(parseFloat(pastWeight)))
          return alert(
            "Invalid Input",
            "Enter a valid weight",
            [{ text: "OK" }],
            "error",
          )
        const value = parseFloat(pastWeight)
        const recordedAt = buildLocalISOForDate(date, "08:00")
        await bodyTrackingApi.logWeight(value, weightUnit as any, null, recordedAt)
        alert("Logged", "Weight entry added", [{ text: "OK" }], "success")
      }

      if (tab === "creatine") {
        const grams = parseFloat(pastCreatineGrams)
        if (!grams || isNaN(grams) || grams <= 0)
          return alert(
            "Invalid Input",
            "Enter valid grams",
            [{ text: "OK" }],
            "error",
          )
        const takenAt = buildLocalISOForDate(date, pastCreatineTime)
        await bodyTrackingApi.markCreatineTaken(grams, null, takenAt)
        alert("Logged", `${grams}g creatine added`, [{ text: "OK" }], "success")
      }

      if (tab === "macros") {
        const protein =
          pastMacrosProtein !== "" ? parseFloat(pastMacrosProtein) : undefined
        const carbs =
          pastMacrosCarbs !== "" ? parseFloat(pastMacrosCarbs) : undefined
        const fat = pastMacrosFat !== "" ? parseFloat(pastMacrosFat) : undefined
        const calories =
          pastMacrosCalories !== "" ? parseFloat(pastMacrosCalories) : undefined
        const hasValue =
          protein != null || carbs != null || fat != null || calories != null
        if (!hasValue && !pastMacrosName.trim())
          return alert(
            "Nothing to log",
            "Enter at least a name or one macro value",
            [{ text: "OK" }],
            "warning",
          )
        const dateStr = toLocalDateStr(date)
        await macrosTrackingApi.logMacros({
          name: pastMacrosName.trim() || undefined,
          protein,
          carbs,
          fat,
          calories,
          errorMargin: parseFloat(pastMacrosError) || 0,
          time: pastMacrosTime,
          date: dateStr,
        })
        alert("Logged", "Macros entry added", [{ text: "OK" }], "success")
      }

      if (tab === "photos") {
        setDayModal(null)
        await pickPhotoForDate(date)
        return
      }

      if (tab === "bodyfat") {
        if (!pastWaist || !pastNeck || (pastGender === "female" && !pastHip))
          return alert(
            "Missing Data",
            "Please enter all measurements",
            [{ text: "OK" }],
            "error",
          )
        let heightCm = height?.height_cm ? parseFloat((height as any).height_cm) : null
        if (!heightCm) {
          return alert(
            "Height Required",
            "Set your height in the Body Fat tab first.",
            [{ text: "OK" }],
            "warning",
          )
        }
        let waistCm = parseFloat(pastWaist)
        let neckCm = parseFloat(pastNeck)
        let hipCm = pastHip ? parseFloat(pastHip) : 0
        if (pastMeasurementUnit === "in") {
          waistCm *= 2.54
          neckCm *= 2.54
          hipCm *= 2.54
        }
        let pct
        if (pastGender === "male") {
          pct =
            495 /
              (1.0324 -
                0.19077 * Math.log10(waistCm - neckCm) +
                0.15456 * Math.log10(heightCm)) -
            450
        } else {
          pct =
            495 /
              (1.29579 -
                0.35004 * Math.log10(waistCm + hipCm - neckCm) +
                0.221 * Math.log10(heightCm)) -
            450
        }
        const dateIso = buildLocalISOForDate(date)
        await bodyFatApi.logBodyFat(
          parseFloat(pct.toFixed(1)),
          { waist: waistCm, neck: neckCm, hip: hipCm, unit: "cm" },
          pastGender as any,
          dateIso,
        )
        alert(
          "Logged",
          `Body fat ${pct.toFixed(1)}% added`,
          [{ text: "OK" }],
          "success",
        )
      }

      setDayModal(null)
      loadData()
    } catch (err: any) {
      alert(
        "Error",
        err.message || "Failed to save entry",
        [{ text: "OK" }],
        "error",
      )
    }
  }

  // ─────────────────────────────────────────────────────────────
  // DATA LOADING
  // ─────────────────────────────────────────────────────────────
  const getWeightChartData = () => {
    if (weightHistory.length < 2)
      return { labels: ["No data"], datasets: [{ data: [0] }] }
    const recentEntries = [...weightHistory].slice(0, 30).reverse()
    const maxLabels = 8
    const labelInterval = Math.ceil(recentEntries.length / maxLabels)
    const labels = recentEntries.map((entry, index) => {
      if (recentEntries.length <= maxLabels || index % labelInterval === 0) {
        return new Date(entry.recorded_at).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })
      }
      return ""
    })
    const data = recentEntries.map((entry: any) =>
      weightUnit === "kg" ? entry.weight_kg : entry.weight_kg * 2.20462,
    )
    return { labels, datasets: [{ data }] }
  }

  useEffect(() => {
    if (user?.id) loadData()
  }, [user?.id])

  const loadData = async () => {
    setLoading(true)
    try {
      await loadFromServer()
    } catch (err: any) {
      console.warn("Server load failed:", err.message)
    } finally {
      setLoading(false)
    }
  }

  const onRefresh = async () => {
    setRefreshing(true)
    try {
      await loadFromServer()
    } catch (err: any) {
      console.warn("Refresh failed:", err.message)
    } finally {
      setRefreshing(false)
    }
  }

  const loadFromServer = async () => {
    const weightData: any = await bodyTrackingApi.getWeightHistory()
    const weightEntries = weightData.entries || []
    const validWeightEntries = weightEntries
      .map((e: any) => ({ ...e, weight_kg: parseFloat(e.weight_kg) }))
      .filter((e: any) => !isNaN(e.weight_kg) && e.weight_kg > 0)
      .sort((a: any, b: any) => (new Date(b.recorded_at) as any) - (new Date(a.recorded_at) as any))
    setWeightHistory(validWeightEntries)
    setWeightUnit(weightData.unit || "kg")

    try {
      const heightData = await bodyTrackingApi.getHeightAndUnits() as any
      if (heightData?.height) {
        setHeight(heightData.height)
        setHeightUnit(heightData.height.height_unit || "cm")
      }
    } catch {}

    const creatineData: any = await bodyTrackingApi.getCreatineStatus()
    if (creatineData.settings) {
      setCreatineEnabled(creatineData.settings.enabled)
      setCreatineTime(creatineData.settings.reminderTime)
      setDefaultCreatineGrams(creatineData.settings.defaultGrams || 5)
      setCreatineGrams(String(creatineData.settings.defaultGrams || 5))
    }
    setCreatineTakenToday(creatineData.takenToday || false)
    setCreatineStreak(creatineData.streak || 0)

    const creatineHistoryData: any = await bodyTrackingApi.getCreatineHistory(90)
    setCreatineHistory(creatineHistoryData.entries || [])

    try {
      const locationData = await creatineApi.getReminderLocation() as any
      if (locationData.location) {
        setReminderLocation(locationData.location)
        setLocationBasedReminder(locationData.enabled || false)
      }
    } catch {}

    const photoData: any = await bodyTrackingApi.getPhotoList()
    setProgressPhotos(photoData.photos || [])

    const macrosData = await macrosTrackingApi.getMacrosHistory(30) as any
    setMacrosEntries(macrosData.entries || [])
    const macrosGoals: any = await macrosTrackingApi.getMacrosGoals()
    setDailyMacrosGoals(
      macrosGoals.goals || {
        protein: 150,
        carbs: 250,
        fat: 65,
        calories: 2000,
      },
    )

    const bodyFatData: any = await bodyFatApi.getBodyFatHistory()
    const sortedBodyFat = (bodyFatData.entries || []).sort(
      (a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    )
    setBodyFatHistory(sortedBodyFat)

    const savedGoal = await AsyncStorage.getItem(getUserKey("weightGoal"))
    if (savedGoal) setWeightGoal(parseFloat(savedGoal))

    const savedGender = await AsyncStorage.getItem(getUserKey("gender"))
    if (savedGender) setGender(savedGender)
  }

  useEffect(() => {
    if (activeTab === "photos" && progressPhotos.length > 0) {
      progressPhotos.slice(0, 20).forEach((p: any) => fetchPhotoUri(p.id))
    }
  }, [activeTab, progressPhotos])

  // ─────────────────────────────────────────────────────────────
  // WEIGHT TREND
  // ─────────────────────────────────────────────────────────────
  const getWeightTrend = () => {
    if (weightHistory.length < 2) return null
    const currentWeight = weightHistory[0].weight_kg
    const compareEntries = weightHistory.slice(1, trendAverageDays + 1)
    if (compareEntries.length === 0) return null
    const avgWeight =
      compareEntries.reduce((sum, e) => sum + e.weight_kg, 0) /
      compareEntries.length
    const diff = currentWeight - avgWeight
    const percentChange = (diff / avgWeight) * 100
    return {
      diff,
      percentChange,
      direction: diff > 0 ? "up" : diff < 0 ? "down" : "stable",
      avgWeight,
      daysCompared: compareEntries.length,
    }
  }

  // ─────────────────────────────────────────────────────────────
  // MACROS HELPERS
  // ─────────────────────────────────────────────────────────────
  const addMacrosEntry = async () => {
    const protein =
      newMacrosProtein !== "" ? parseFloat(newMacrosProtein) : undefined
    const carbs = newMacrosCarbs !== "" ? parseFloat(newMacrosCarbs) : undefined
    const fat = newMacrosFat !== "" ? parseFloat(newMacrosFat) : undefined
    const calories =
      newMacrosCalories !== "" ? parseFloat(newMacrosCalories) : undefined

    const hasValue =
      protein != null || carbs != null || fat != null || calories != null
    if (!hasValue && !newMacrosName.trim()) {
      return alert(
        "Nothing to log",
        "Enter at least a name or one value",
        [{ text: "OK" }],
        "warning",
      )
    }

    try {
      const dateStr = selectedLogDate ? toLocalDateStr(selectedLogDate) : null
      await macrosTrackingApi.logMacros({
        name: newMacrosName.trim() || undefined,
        protein,
        carbs,
        fat,
        calories,
        errorMargin: parseFloat(newMacrosError) || 0,
        time: newMacrosTime,
        date: dateStr,
      })
      setNewMacrosName("")
      setNewMacrosProtein("")
      setNewMacrosCarbs("")
      setNewMacrosFat("")
      setNewMacrosCalories("")
      setNewMacrosError("5")
      setNewMacrosTime(new Date().toTimeString().slice(0, 5))
      setShowMacrosModal(false)
      setSelectedLogDate(null)
      alert("Logged", "Macros logged!", [{ text: "OK" }], "success")
      loadData()
    } catch (error) {
      alert("Error", (error as any)?.message, [{ text: "OK" }], "error")
    }
  }

  const getDailyMacrosStats = (date: any) => {
    const dateStr = toLocalDateStr(date)
    const entries = macrosEntries.filter(
      (e) => isoToLocalDateStr(e.date) === dateStr,
    )
    if (entries.length === 0) return null
    const normed = entries.map((e: any) => ({
      ...e,
      protein: e.protein != null ? parseFloat(e.protein) : null,
      carbs: e.carbs != null ? parseFloat(e.carbs) : null,
      fat: e.fat != null ? parseFloat(e.fat) : null,
      calories: e.calories != null ? parseFloat(e.calories) : null,
      errorMargin: parseFloat(e.errorMargin) || 0,
    }))
    const sumField = (field: any) =>
      normed.reduce((s, e) => (e[field] != null ? s + e[field] : s), 0)
    const hasAny = (field: any) => normed.some((e) => e[field] != null)
    const avgError =
      normed.reduce((s, e) => s + e.errorMargin, 0) / normed.length
    const makeStat = (field: any, goal: any) => {
      if (!hasAny(field)) return null
      const total = sumField(field)
      return {
        total,
        min: total * (1 - avgError / 100),
        max: total * (1 + avgError / 100),
        goal,
        percentage: (total / goal) * 100,
      }
    }
    return {
      protein: makeStat("protein", dailyMacrosGoals.protein),
      carbs: makeStat("carbs", dailyMacrosGoals.carbs),
      fat: makeStat("fat", dailyMacrosGoals.fat),
      calories: makeStat("calories", dailyMacrosGoals.calories),
      entries: normed.length,
      entriesList: normed,
    }
  }

  const updateMacrosGoals = async () => {
    const protein = parseFloat(macrosGoalInput.protein)
    const carbs = parseFloat(macrosGoalInput.carbs)
    const fat = parseFloat(macrosGoalInput.fat)
    const calories = parseFloat(macrosGoalInput.calories)
    if (
      isNaN(protein) ||
      protein <= 0 ||
      isNaN(carbs) ||
      carbs <= 0 ||
      isNaN(fat) ||
      fat <= 0 ||
      isNaN(calories) ||
      calories <= 0
    ) {
      return alert(
        "Invalid Input",
        "Please enter valid goals",
        [{ text: "OK" }],
        "error",
      )
    }
    try {
      await macrosTrackingApi.setMacrosGoals({ protein, carbs, fat, calories })
      setDailyMacrosGoals({ protein, carbs, fat, calories })
      setShowMacrosGoalModal(false)
    } catch (error) {
      alert("Error", (error as any)?.message, [{ text: "OK" }], "error")
    }
  }

  // ─────────────────────────────────────────────────────────────
  // BODY FAT CALCULATION
  // ─────────────────────────────────────────────────────────────
  const calculateBodyFat = async () => {
    if (!waist || !neck || (gender === "female" && !hip)) {
      return alert(
        "Missing Data",
        "Please enter all measurements",
        [{ text: "OK" }],
        "error",
      )
    }
    let heightCm = height?.height_cm ? parseFloat((height as any).height_cm) : null
    if (!heightCm) {
      return alert(
        "Height Required",
        "Please set your height first.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Set Height",
            onPress: () => {
              setShowBodyFatModal(false)
              setShowHeightModal(true)
            },
          },
        ],
        "warning",
      )
    }
    let waistCm = parseFloat(waist)
    let neckCm = parseFloat(neck)
    let hipCm = hip ? parseFloat(hip) : 0
    if (measurementUnit === "in") {
      waistCm *= 2.54
      neckCm *= 2.54
      hipCm *= 2.54
    }
    let bodyFatPercentage
    if (gender === "male") {
      bodyFatPercentage =
        495 /
          (1.0324 -
            0.19077 * Math.log10(waistCm - neckCm) +
            0.15456 * Math.log10(heightCm)) -
        450
    } else {
      bodyFatPercentage =
        495 /
          (1.29579 -
            0.35004 * Math.log10(waistCm + hipCm - neckCm) +
            0.221 * Math.log10(heightCm)) -
        450
    }
    try {
      const dateStr = selectedLogDate ? toLocalDateStr(selectedLogDate) : null
      await bodyFatApi.logBodyFat(
        parseFloat(bodyFatPercentage.toFixed(1)),
        { waist: waistCm, neck: neckCm, hip: hipCm, unit: "cm" },
        gender as any,
        dateStr,
      )
      setSelectedLogDate(null)
      alert(
        "Body Fat Calculated",
        `Your body fat is ${bodyFatPercentage.toFixed(1)}%`,
        [{ text: "OK" }],
        "success",
      )
      loadData()
    } catch (error) {
      alert("Error", (error as any)?.message, [{ text: "OK" }], "error")
    }
  }

  // ─────────────────────────────────────────────────────────────
  // CREATINE METHODS
  // ─────────────────────────────────────────────────────────────
  const markCreatineTaken = async () => {
    const grams = parseFloat(creatineGrams)
    if (!grams || isNaN(grams) || grams <= 0)
      return alert(
        "Invalid Input",
        "Enter valid grams",
        [{ text: "OK" }],
        "error",
      )
    try {
      await bodyTrackingApi.markCreatineTaken(grams)
      setCreatineTakenToday(true)
      setShowCreatineModal(false)
      alert(
        "Success",
        `Logged ${grams}g of creatine`,
        [{ text: "OK" }],
        "success",
      )
      loadData()
    } catch (error) {
      alert("Error", (error as any)?.message, [{ text: "OK" }], "error")
    }
  }

  // ─────────────────────────────────────────────────────────────
  // PHOTO METHODS
  // ─────────────────────────────────────────────────────────────
  const fetchPhotoUri = async (photoId: any) => {
    if (photoUriCache[photoId] || photoUriLoading[photoId]) return
    setPhotoUriLoading((prev: any) => ({ ...prev, [photoId]: true }))
    try {
      const localUri = `${FileSystem.cacheDirectory}photo_${photoId}.jpg`
      const info = await FileSystem.getInfoAsync(localUri)
      if (info.exists) {
        setPhotoUriCache((prev: any) => ({ ...prev, [photoId]: localUri }))
        return
      }
      const result = await FileSystem.downloadAsync(
        bodyTrackingApi.getPhotoUrl(photoId),
        localUri,
        { headers: { Authorization: `Bearer ${authToken}` } },
      )
      if (result.status === 200) {
        setPhotoUriCache((prev: any) => ({ ...prev, [photoId]: result.uri }))
      } else {
        throw new Error(`Server returned ${result.status}`)
      }
    } catch (error) {
      setPhotoUriCache((prev: any) => ({ ...prev, [photoId]: "error" }))
    } finally {
      setPhotoUriLoading((prev: any) => ({ ...prev, [photoId]: false }))
    }
  }

  const prefetchPhotosForDate = async (photos: any) => {
    await Promise.all(photos.map((p: any) => fetchPhotoUri(p.id)))
  }

  useEffect(() => {
    if (showDatePhotosModal && selectedDatePhotos?.photos?.length) {
      prefetchPhotosForDate(selectedDatePhotos.photos)
    }
  }, [showDatePhotosModal, selectedDatePhotos])

  useEffect(() => {
    if (dayModal?.tab === "photos" && dayModal?.existingEntries?.length) {
      prefetchPhotosForDate(dayModal.existingEntries)
    }
  }, [dayModal])

  const takePhoto = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync()
      if (!permissionResult.granted) {
        alert(
          "Permission Required",
          "Camera access is needed",
          [{ text: "OK" }],
          "warning",
        )
        return
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: "images",
        quality: 0.8,
        allowsEditing: true,
        aspect: [3, 4],
      })
      if (!result.canceled && result.assets?.[0]) {
        const dateStr = selectedLogDate ? toLocalDateStr(selectedLogDate) : null
        await uploadPhoto(result.assets[0].uri, dateStr)
      }
    } catch (error) {
      alert("Error", "Failed to take photo.", [{ text: "OK" }], "error")
    }
  }

  const pickPhotoFromGallery = async () => {
    try {
      const permissionResult =
        await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!permissionResult.granted) {
        alert(
          "Permission Required",
          "Photo library access is needed",
          [{ text: "OK" }],
          "warning",
        )
        return
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        quality: 0.8,
        allowsEditing: true,
        aspect: [3, 4],
      })
      if (!result.canceled && result.assets?.[0]) {
        const dateStr = selectedLogDate ? toLocalDateStr(selectedLogDate) : null
        await uploadPhoto(result.assets[0].uri, dateStr)
      }
    } catch (error) {
      alert("Error", "Failed to select photo.", [{ text: "OK" }], "error")
    }
  }

  const pickPhotoForDate = async (date: any) => {
    try {
      const permissionResult =
        await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!permissionResult.granted) {
        alert(
          "Permission Required",
          "Photo library access is needed",
          [{ text: "OK" }],
          "warning",
        )
        return
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        quality: 0.8,
        allowsEditing: true,
        aspect: [3, 4],
      })
      if (!result.canceled && result.assets?.[0]) {
        await bodyTrackingApi.uploadProgressPhoto(
          result.assets[0].uri,
          "image/jpeg",
          null,
          toLocalDateStr(date),
        )
        alert(
          "Photo added",
          `Photo saved for ${date.toLocaleDateString()}`,
          [{ text: "OK" }],
          "success",
        )
        loadData()
      }
    } catch (error) {
      alert("Error", "Failed to add photo.", [{ text: "OK" }], "error")
    }
  }

  const uploadPhoto = async (uri: string, dateStr: string | null = null) => {
    try {
      await bodyTrackingApi.uploadProgressPhoto(
        uri,
        "image/jpeg",
        null,
        dateStr,
      )
      setSelectedLogDate(null)
      alert("Success", "Progress photo saved!", [{ text: "OK" }], "success")
      loadData()
    } catch (error) {
      alert("Error", "Failed to upload photo", [{ text: "OK" }], "error")
    }
  }

  const getPhotosForDate = (date: any) => {
    const dateStr = toLocalDateStr(date)
    return progressPhotos.filter(
      (p: any) => isoToLocalDateStr(p?.takenAt) === dateStr,
    )
  }

  // ─────────────────────────────────────────────────────────────
  // WEIGHT ACTIONS
  // ─────────────────────────────────────────────────────────────
  const addWeight = async () => {
    if (!newWeight || isNaN(parseFloat(newWeight)))
      return alert(
        "Invalid Input",
        "Enter a valid weight",
        [{ text: "OK" }],
        "error",
      )
    try {
      const recordedAt = selectedLogDate
        ? buildLocalISOForDate(selectedLogDate, "08:00")
        : null
      await bodyTrackingApi.logWeight(
        parseFloat(newWeight),
        weightUnit as any,
        null,
        recordedAt,
      )
      setNewWeight("")
      setShowWeightModal(false)
      setSelectedLogDate(null)
      alert("Success", "Weight logged!", [{ text: "OK" }], "success")
      loadData()
    } catch (err: any) {
      alert("Error", err.message, [{ text: "OK" }], "error")
    }
  }

  const loadMoreWeightEntries = () =>
    setWeightEntriesShown((prev: any) => Math.min(prev + 10, weightHistory.length))

  // ─────────────────────────────────────────────────────────────
  // CALENDAR HAS-DATA CHECKERS
  // ─────────────────────────────────────────────────────────────
  const hasWeightData = (date: any) => {
    const dateStr = toLocalDateStr(date)
    return weightHistory.some(
      (e) => isoToLocalDateStr(e?.recorded_at) === dateStr,
    )
  }

  const hasPhotoData = (date: any) => {
    const dateStr = toLocalDateStr(date)
    return progressPhotos.some((p: any) => isoToLocalDateStr(p?.takenAt) === dateStr)
  }

  const hasCreatineData = (date: any) => {
    const dateStr = toLocalDateStr(date)
    return creatineHistory.some((c) => {
      const d = c?.taken_at || c?.date
      return isoToLocalDateStr(d) === dateStr
    })
  }

  const hasMacrosData = (date: any) => {
    const dateStr = toLocalDateStr(date)
    return macrosEntries.some((e) => isoToLocalDateStr(e?.date) === dateStr)
  }

  const hasBodyFatData = (date: any) => {
    const dateStr = toLocalDateStr(date)
    return bodyFatHistory.some((b: any) => isoToLocalDateStr(b?.date) === dateStr)
  }

  // ─────────────────────────────────────────────────────────────
  // HEIGHT
  // ─────────────────────────────────────────────────────────────
  const saveHeight = async () => {
    try {
      let heightValue
      if (heightUnit === "cm") {
        heightValue = parseFloat(newHeightCm)
        if (!heightValue || isNaN(heightValue) || heightValue <= 0)
          return alert(
            "Invalid Input",
            "Enter a valid height",
            [{ text: "OK" }],
            "error",
          )
      } else {
        const ft = parseFloat(newHeightFt)
        if (!ft || isNaN(ft) || ft <= 0)
          return alert(
            "Invalid Input",
            "Enter valid feet",
            [{ text: "OK" }],
            "error",
          )
        heightValue = ft
      }
      const heightData = {
        value: heightValue,
        unit: heightUnit,
        ...(heightUnit === "ft" && { inches: parseFloat(newHeightIn) || 0 }),
      }
      await bodyTrackingApi.saveHeightAndUnits(heightData as any, weightUnit as any)
      await loadData()
      setShowHeightModal(false)
      setNewHeightCm("")
      setNewHeightFt("")
      setNewHeightIn("")
      alert("Success", "Height saved!", [{ text: "OK" }], "success")
    } catch (error) {
      alert("Error", (error as any)?.message, [{ text: "OK" }], "error")
    }
  }

  // ─────────────────────────────────────────────────────────────
  // RENDER HELPERS
  // ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView
        style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
      >
        <ActivityIndicator size='large' color='#667eea' />
        <Text style={{ marginTop: 12, color: "#666" }}>
          Loading tracking data…
        </Text>
      </SafeAreaView>
    )
  }

  const weightTrend = getWeightTrend()

  const renderPhotoGrid = () => {
    if (progressPhotos.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No progress photos yet</Text>
        </View>
      )
    }
    const grouped: Record<string, any[]> = {}
    progressPhotos.forEach((p: any) => {
      const d = isoToLocalDateStr(p?.takenAt)
      if (!grouped[d]) grouped[d] = []
      grouped[d].push(p)
    })
    const sortedDates = Object.keys(grouped).sort((a: any, b: any) => b.localeCompare(a))
    return sortedDates.slice(0, 10).map((dateStr: any) => {
      const photos = grouped[dateStr]
      const label = new Date(dateStr + "T12:00:00").toLocaleDateString(
        "en-US",
        { weekday: "short", month: "short", day: "numeric" },
      )
      return (
        <View key={dateStr} style={styles.photoGroupContainer}>
          <Text style={styles.photoGroupDate}>{label}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.photoGroupRow}
          >
            {photos.map((photo: any) => {
              const uri = photoUriCache[photo.id]
              const isLoading = !uri && photoUriLoading[photo.id]
              const isError = uri === "error"
              const isReady = uri && !isError
              return (
                <TouchableOpacity
                  key={photo.id}
                  style={styles.photoThumbWrap}
                  activeOpacity={isReady ? 0.8 : 1}
                  onPress={() => isReady && setExpandedPhoto({ uri, photo })}
                >
                  {isReady ? (
                    <Image
                      source={{ uri }}
                      style={styles.photoThumb}
                      resizeMode='cover'
                    />
                  ) : isError ? (
                    <View style={[styles.photoThumb, styles.photoThumbError]}>
                      <Text style={{ fontSize: 20 }}>⚠️</Text>
                    </View>
                  ) : (
                    <View style={[styles.photoThumb, styles.photoThumbLoading]}>
                      <ActivityIndicator size='small' color='#667eea' />
                    </View>
                  )}
                  <TouchableOpacity
                    style={styles.photoThumbDelete}
                    onPress={() => deletePhoto(photo)}
                    hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                  >
                    <Text style={styles.photoThumbDeleteText}>✕</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              )
            })}
          </ScrollView>
        </View>
      )
    })
  }

  const renderDayModalExistingEntries = () => {
    const existingEntries = dayModal?.existingEntries
    if (!existingEntries || existingEntries.length === 0) return null
    const { tab } = dayModal

    if (tab === "weight") {
      return (
        <View style={styles.existingEntriesSection}>
          <Text style={styles.existingEntriesTitle}>Logged entries</Text>
          {existingEntries.map((entry: any, i: any) => {
            const val =
              weightUnit === "kg"
                ? `${entry.weight_kg.toFixed(1)} kg`
                : `${(entry.weight_kg * 2.20462).toFixed(1)} lbs`
            const time = new Date(entry.recorded_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })
            return (
              <View key={entry.id ?? i} style={styles.existingEntryRow}>
                <Text style={styles.existingEntryTime}>{time}</Text>
                <Text style={styles.existingEntryValue}>{val}</Text>
                <TouchableOpacity
                  onPress={() => deleteWeightEntry(entry)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.existingEntryDelete}>🗑</Text>
                </TouchableOpacity>
              </View>
            )
          })}
        </View>
      )
    }

    if (tab === "creatine") {
      return (
        <View style={styles.existingEntriesSection}>
          <Text style={styles.existingEntriesTitle}>Logged entries</Text>
          {existingEntries.map((entry: any, i: any) => {
            const d = entry?.taken_at || entry?.date
            const time = new Date(d).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })
            return (
              <View key={entry.id ?? i} style={styles.existingEntryRow}>
                <Text style={styles.existingEntryTime}>{time}</Text>
                <Text style={styles.existingEntryValue}>
                  {entry.grams ?? 5}g
                </Text>
                {entry.note ? (
                  <Text style={styles.existingEntryNote}>"{entry.note}"</Text>
                ) : null}
                <TouchableOpacity
                  onPress={() => deleteCreatineEntry(entry)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.existingEntryDelete}>🗑</Text>
                </TouchableOpacity>
              </View>
            )
          })}
        </View>
      )
    }

    if (tab === "macros") {
      return (
        <View style={styles.existingEntriesSection}>
          <Text style={styles.existingEntriesTitle}>Logged entries</Text>
          {existingEntries.map((entry: any, i: any) => (
            <View key={entry.id ?? i} style={styles.existingEntryRow}>
              <View style={{ flex: 1 }}>
                {entry.name ? (
                  <Text style={styles.existingEntryName}>{entry.name}</Text>
                ) : null}
                <Text style={styles.existingEntryTime}>{entry.time}</Text>
                <Text style={styles.existingEntryMacros}>
                  {[
                    entry.calories != null
                      ? `${parseFloat(entry.calories).toFixed(0)} kcal`
                      : null,
                    entry.protein != null
                      ? `P:${parseFloat(entry.protein).toFixed(0)}g`
                      : null,
                    entry.carbs != null
                      ? `C:${parseFloat(entry.carbs).toFixed(0)}g`
                      : null,
                    entry.fat != null
                      ? `F:${parseFloat(entry.fat).toFixed(0)}g`
                      : null,
                  ]
                    .filter(Boolean)
                    .join("  ·  ")}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => deleteMacroEntry(entry)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.existingEntryDelete}>🗑</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )
    }

    if (tab === "photos") {
      return (
        <View style={styles.existingEntriesSection}>
          <Text style={styles.existingEntriesTitle}>Photos on this day</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginTop: 6 }}
          >
            {existingEntries.map((photo: any) => {
              const uri = photoUriCache[photo.id]
              const isLoading = !uri && photoUriLoading[photo.id]
              const isError = uri === "error"
              const isReady = uri && !isError
              return (
                <TouchableOpacity
                  key={photo.id}
                  style={styles.photoThumbWrap}
                  activeOpacity={isReady ? 0.8 : 1}
                  onPress={() => isReady && setExpandedPhoto({ uri, photo })}
                >
                  {isReady ? (
                    <Image
                      source={{ uri }}
                      style={styles.photoThumb}
                      resizeMode='cover'
                    />
                  ) : isError ? (
                    <View style={[styles.photoThumb, styles.photoThumbError]}>
                      <Text style={{ fontSize: 20 }}>⚠️</Text>
                    </View>
                  ) : (
                    <View style={[styles.photoThumb, styles.photoThumbLoading]}>
                      <ActivityIndicator size='small' color='#667eea' />
                    </View>
                  )}
                  <TouchableOpacity
                    style={styles.photoThumbDelete}
                    onPress={() => deletePhoto(photo)}
                    hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                  >
                    <Text style={styles.photoThumbDeleteText}>✕</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              )
            })}
          </ScrollView>
        </View>
      )
    }

    if (tab === "bodyfat") {
      return (
        <View style={styles.existingEntriesSection}>
          <Text style={styles.existingEntriesTitle}>Logged measurement</Text>
          {existingEntries.map((entry: any, i: any) => (
            <View key={entry.id ?? i} style={styles.existingEntryRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.existingEntryValue}>
                  {entry.percentage}%
                </Text>
                <Text style={styles.existingEntryTime}>
                  Waist{" "}
                  {entry.measurements?.waist != null
                    ? Number(entry.measurements.waist).toFixed(1)
                    : "—"}
                  cm · Neck{" "}
                  {entry.measurements?.neck != null
                    ? Number(entry.measurements.neck).toFixed(1)
                    : "—"}
                  cm
                  {entry.measurements?.hip != null &&
                  entry.measurements.hip !== 0
                    ? ` · Hip ${Number(entry.measurements.hip).toFixed(1)}cm`
                    : ""}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => deleteBodyFatEntry(entry)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.existingEntryDelete}>🗑</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )
    }

    return null
  }

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#667eea"]}
            tintColor='#667eea'
          />
        }
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>📊 Advanced Tracking</Text>
            <Text style={styles.subtitle}>
              Comprehensive body composition and nutrition tracking
            </Text>
          </View>

          {/* TAB SELECTOR */}
          <View style={styles.tabContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {[
                { key: "weight", icon: "⚖️", label: "Weight" },
                { key: "photos", icon: "📸", label: "Photos" },
                { key: "creatine", icon: "💊", label: "Creatine" },
                { key: "macros", icon: "🥗", label: "Macros" },
                { key: "bodyfat", icon: "📐", label: "Body Fat" },
              ].map((tab: any) => (
                <TouchableOpacity
                  key={tab.key}
                  style={[
                    styles.tab,
                    activeTab === tab.key && styles.tabActive,
                  ]}
                  onPress={() => setActiveTab(tab.key)}
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
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* ── WEIGHT TAB ── */}
          {activeTab === "weight" && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Weight Tracking</Text>
              <UniversalCalendar
                hasDataOnDate={hasWeightData}
                onDatePress={(date: any) => handleCalendarDatePress(date, "weight")}
                initialView='week'
                legendText='Weight logged · tap any day to view/add'
                dotColor='#667eea'
              />
              {weightHistory.length > 0 ? (
                <View style={styles.statsCard}>
                  <Text style={styles.statsTitle}>Current Weight</Text>
                  <Text style={styles.statsValue}>
                    {weightUnit === "kg"
                      ? `${weightHistory[0].weight_kg.toFixed(1)} kg`
                      : `${(weightHistory[0].weight_kg * 2.20462).toFixed(1)} lbs`}
                  </Text>
                  <Text style={styles.statsDate}>
                    {new Date(
                      weightHistory[0].recorded_at,
                    ).toLocaleDateString()}
                  </Text>
                  {weightTrend && (
                    <View style={styles.trendContainer}>
                      <View
                        style={[
                          styles.trendBadge,
                          weightTrend.direction === "up"
                            ? styles.trendUp
                            : weightTrend.direction === "down"
                              ? styles.trendDown
                              : styles.trendStable,
                        ]}
                      >
                        <Text style={styles.trendIcon}>
                          {weightTrend.direction === "up"
                            ? "↗"
                            : weightTrend.direction === "down"
                              ? "↘"
                              : "→"}
                        </Text>
                        <Text style={styles.trendText}>
                          {Math.abs(weightTrend.diff).toFixed(1)} {weightUnit}
                        </Text>
                        <Text style={styles.trendPercent}>
                          ({weightTrend.percentChange > 0 ? "+" : ""}
                          {weightTrend.percentChange.toFixed(1)}%)
                        </Text>
                      </View>
                      <Text style={styles.trendSubtext}>
                        vs. {weightTrend.daysCompared}-day average
                      </Text>
                      <View style={styles.trendSelector}>
                        {[3, 7, 14, 30].map((days: any) => (
                          <TouchableOpacity
                            key={days}
                            style={[
                              styles.trendOption,
                              trendAverageDays === days &&
                                styles.trendOptionActive,
                            ]}
                            onPress={() => setTrendAverageDays(days)}
                          >
                            <Text
                              style={[
                                styles.trendOptionText,
                                trendAverageDays === days &&
                                  styles.trendOptionTextActive,
                              ]}
                            >
                              {days}d
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>
                    No weight data logged yet
                  </Text>
                </View>
              )}
              {weightHistory.length > 0 && (
                <View style={styles.weightHistoryCard}>
                  <Text style={styles.weightHistoryTitle}>Recent Entries</Text>
                  {weightHistory
                    .slice(0, weightEntriesShown)
                    .map((entry, index) => {
                      const val =
                        weightUnit === "kg"
                          ? `${entry.weight_kg.toFixed(1)} kg`
                          : `${(entry.weight_kg * 2.20462).toFixed(1)} lbs`
                      const isLatest = index === 0
                      return (
                        <View
                          key={entry.id ?? index}
                          style={[
                            styles.weightEntryRow,
                            index <
                              weightHistory.slice(0, weightEntriesShown)
                                .length -
                                1 && styles.weightEntryRowBorder,
                          ]}
                        >
                          <View>
                            <Text style={styles.weightEntryDate}>
                              {new Date(entry.recorded_at).toLocaleDateString(
                                [],
                                {
                                  weekday: "short",
                                  month: "short",
                                  day: "numeric",
                                },
                              )}
                            </Text>
                            <Text style={styles.weightEntryTime}>
                              {new Date(entry.recorded_at).toLocaleTimeString(
                                [],
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                },
                              )}
                            </Text>
                          </View>
                          <View style={styles.weightEntryRight}>
                            <View style={styles.weightEntryValueRow}>
                              <Text
                                style={[
                                  styles.weightEntryValue,
                                  isLatest && styles.weightEntryValueLatest,
                                ]}
                              >
                                {val}
                              </Text>
                              <TouchableOpacity
                                style={styles.deleteEntryBtn}
                                onPress={() => deleteWeightEntry(entry)}
                                hitSlop={{
                                  top: 8,
                                  bottom: 8,
                                  left: 8,
                                  right: 8,
                                }}
                              >
                                <Text style={styles.deleteEntryBtnText}>
                                  🗑
                                </Text>
                              </TouchableOpacity>
                            </View>
                            {isLatest && (
                              <Text style={styles.weightEntryLatestBadge}>
                                latest
                              </Text>
                            )}
                          </View>
                        </View>
                      )
                    })}
                  {weightEntriesShown < weightHistory.length && (
                    <TouchableOpacity
                      style={styles.loadMoreButton}
                      onPress={loadMoreWeightEntries}
                    >
                      <Text style={styles.loadMoreText}>
                        View More ({weightHistory.length - weightEntriesShown}{" "}
                        more)
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
              {weightHistory.length > 1 && (
                <ProgressChart
                  title='Weight Trend'
                  icon='📈'
                  data={getWeightChartData()}
                  yAxisSuffix={weightUnit}
                />
              )}
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => {
                  setSelectedLogDate(null)
                  setShowWeightModal(true)
                }}
              >
                <Text style={styles.primaryButtonText}>+ Log Weight</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── PHOTOS TAB ── */}
          {activeTab === "photos" && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Progress Photos</Text>
              <UniversalCalendar
                hasDataOnDate={hasPhotoData}
                onDatePress={(date: any) => handleCalendarDatePress(date, "photos")}
                initialView='week'
                legendText='Photo taken · tap any day to view/add'
                dotColor='#10b981'
              />
              {renderPhotoGrid()}
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() => {
                    setSelectedLogDate(null)
                    takePhoto()
                  }}
                >
                  <Text style={styles.primaryButtonText}>📷 Take Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => {
                    setSelectedLogDate(null)
                    pickPhotoFromGallery()
                  }}
                >
                  <Text style={styles.secondaryButtonText}>🖼️ Gallery</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ── CREATINE TAB ── */}
          {activeTab === "creatine" && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Creatine Tracking</Text>
              <UniversalCalendar
                hasDataOnDate={hasCreatineData}
                onDatePress={(date: any) =>
                  handleCalendarDatePress(date, "creatine")
                }
                initialView='week'
                legendText='Creatine taken · tap any day to view/add'
                dotColor='#f59e0b'
              />
              <View style={styles.creatineStatsCard}>
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Current Streak:</Text>
                  <Text style={styles.statValue}>{creatineStreak} days 🔥</Text>
                </View>
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>This Month:</Text>
                  <Text style={styles.statValue}>
                    {(() => {
                      const currentMonth = new Date().toISOString().slice(0, 7)
                      return `${
                        creatineHistory.filter((c: any) => {
                          const d = c?.taken_at || c?.date
                          return (
                            d &&
                            typeof d === "string" &&
                            d.startsWith(currentMonth)
                          )
                        }).length
                      } days`
                    })()}
                  </Text>
                </View>
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Taken Today:</Text>
                  <Text style={styles.statValue}>
                    {creatineTakenToday ? "✅ Yes" : "❌ No"}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  creatineTakenToday && styles.primaryButtonDisabled,
                ]}
                onPress={() => {
                  setSelectedLogDate(null)
                  setShowQuickLogCreatine(true)
                }}
                disabled={creatineTakenToday}
              >
                <Text style={styles.primaryButtonText}>
                  {creatineTakenToday ? "✓ Taken Today" : "✓ Mark Taken"}
                </Text>
              </TouchableOpacity>
              {creatineHistory.length > 0 && (
                <View style={styles.weightHistoryCard}>
                  <Text style={styles.weightHistoryTitle}>Recent Intakes</Text>
                  {creatineHistory.slice(0, 10).map((entry, index) => {
                    const d = entry?.taken_at || entry?.date
                    return (
                      <View
                        key={entry.id ?? index}
                        style={[
                          styles.weightEntryRow,
                          index < Math.min(creatineHistory.length, 10) - 1 &&
                            styles.weightEntryRowBorder,
                        ]}
                      >
                        <View>
                          <Text style={styles.weightEntryDate}>
                            {new Date(d).toLocaleDateString([], {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                            })}
                          </Text>
                          <Text style={styles.weightEntryTime}>
                            {new Date(d).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </Text>
                        </View>
                        <View style={styles.weightEntryValueRow}>
                          <Text style={styles.weightEntryValue}>
                            {entry.grams ?? 5}g
                          </Text>
                          <TouchableOpacity
                            style={styles.deleteEntryBtn}
                            onPress={() => deleteCreatineEntry(entry)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Text style={styles.deleteEntryBtnText}>🗑</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )
                  })}
                </View>
              )}
            </View>
          )}

          {/* ── MACROS TAB ── */}
          {activeTab === "macros" && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Macros Tracking</Text>
                <TouchableOpacity
                  style={styles.goalButton}
                  onPress={() => {
                    setMacrosGoalInput({
                      protein: String(dailyMacrosGoals.protein),
                      carbs: String(dailyMacrosGoals.carbs),
                      fat: String(dailyMacrosGoals.fat),
                      calories: String(dailyMacrosGoals.calories),
                    })
                    setShowMacrosGoalModal(true)
                  }}
                >
                  <Text style={styles.goalButtonText}>
                    {dailyMacrosGoals.calories} kcal goal
                  </Text>
                </TouchableOpacity>
              </View>
              <UniversalCalendar
                hasDataOnDate={hasMacrosData}
                onDatePress={(date: any) => handleCalendarDatePress(date, "macros")}
                initialView='week'
                legendText='Macros logged · tap any day to view/add'
                dotColor='#ef4444'
              />
              {(() => {
                const todayStats = getDailyMacrosStats(new Date())
                return todayStats ? (
                  <View style={styles.macrosStatsCard}>
                    <Text style={styles.macrosStatsTitle}>Today's Intake</Text>
                    {[
                      {
                        key: "calories",
                        label: "Calories",
                        unit: "kcal",
                        color: "#f59e0b",
                      },
                      {
                        key: "protein",
                        label: "Protein",
                        unit: "g",
                        color: "#667eea",
                      },
                      {
                        key: "carbs",
                        label: "Carbs",
                        unit: "g",
                        color: "#10b981",
                      },
                      { key: "fat", label: "Fat", unit: "g", color: "#ef4444" },
                    ]
                      .filter(({ key }) => (todayStats as any)[key] != null)
                      .map(({ key, label, unit, color }) => {
                        const macro = (todayStats as any)[key]
                        return (
                          <View key={key} style={styles.macroRow}>
                            <View style={styles.macroLabelRow}>
                              <Text style={styles.macroLabel}>{label}</Text>
                              <Text style={styles.macroValue}>
                                {macro.total.toFixed(0)}
                                {unit}
                                <Text style={styles.macroRange}>
                                  {" "}
                                  ({macro.min.toFixed(0)}–{macro.max.toFixed(0)}
                                  )
                                </Text>
                              </Text>
                            </View>
                            <View style={styles.macroProgressBar}>
                              <View
                                style={[
                                  styles.macroProgressFill,
                                  {
                                    width: `${Math.min(macro.percentage, 100)}%`,
                                    backgroundColor: color,
                                  },
                                ]}
                              />
                            </View>
                            <Text style={styles.macroProgressText}>
                              {macro.percentage.toFixed(0)}% of {macro.goal}
                              {unit} goal
                            </Text>
                          </View>
                        )
                      })}
                    <Text style={styles.macrosEntriesCount}>
                      {todayStats.entries}{" "}
                      {todayStats.entries === 1 ? "entry" : "entries"} logged
                    </Text>
                  </View>
                ) : (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>No macros logged today</Text>
                  </View>
                )
              })()}
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => {
                  setSelectedLogDate(null)
                  setShowMacrosModal(true)
                }}
              >
                <Text style={styles.primaryButtonText}>+ Log Macros</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── BODY FAT TAB ── */}
          {activeTab === "bodyfat" && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Body Fat %</Text>
              <View style={styles.heightCard}>
                {height && (height as any).height_cm ? (
                  <View style={styles.heightDisplay}>
                    <View style={styles.heightInfo}>
                      <Text style={styles.heightLabel}>Your Height</Text>
                      <Text style={styles.heightValue}>
                        {heightUnit === "cm"
                          ? `${(height as any).height_cm.toFixed(1)} cm`
                          : `${Math.floor((height as any).height_cm / 2.54 / 12)}' ${Math.round(((height as any).height_cm / 2.54) % 12)}"`}
                      </Text>
                      <Text style={styles.heightNote}>
                        Required for body fat calculation
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.heightEditButton}
                      onPress={() => {
                        if (height?.height_cm) {
                          if (heightUnit === "cm")
                            setNewHeightCm(String((height as any).height_cm.toFixed(1)))
                          else {
                            const ti = (height as any).height_cm / 2.54
                            setNewHeightFt(String(Math.floor(ti / 12)))
                            setNewHeightIn(String(Math.round(ti % 12)))
                          }
                        }
                        setShowHeightModal(true)
                      }}
                    >
                      <Text style={styles.heightEditButtonText}>Edit</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.heightSetButton}
                    onPress={() => setShowHeightModal(true)}
                  >
                    <Text style={styles.heightSetIcon}>📏</Text>
                    <View style={styles.heightSetTextContainer}>
                      <Text style={styles.heightSetTitle}>Set Your Height</Text>
                      <Text style={styles.heightSetSubtitle}>
                        Required to calculate body fat percentage
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
              </View>
              <UniversalCalendar
                hasDataOnDate={hasBodyFatData}
                onDatePress={(date: any) => handleCalendarDatePress(date, "bodyfat")}
                initialView='week'
                legendText='Measurement taken · tap any day to view/add'
                dotColor='#8b5cf6'
              />
              {bodyFatHistory.length > 0 && (
                <View style={styles.bodyFatCard}>
                  <Text style={styles.bodyFatLabel}>Latest Measurement</Text>
                  <Text style={styles.bodyFatValue}>
                    {bodyFatHistory[0].percentage}%
                  </Text>
                  <Text style={styles.bodyFatDate}>
                    {new Date(bodyFatHistory[0].date).toLocaleDateString()}
                  </Text>
                  <Text style={styles.bodyFatMethod}>US Navy Method</Text>
                  <TouchableOpacity
                    style={styles.bodyFatDeleteBtn}
                    onPress={() => deleteBodyFatEntry(bodyFatHistory[0])}
                  >
                    <Text style={styles.bodyFatDeleteBtnText}>
                      🗑 Delete this reading
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => {
                  setSelectedLogDate(null)
                  setShowBodyFatModal(true)
                }}
              >
                <Text style={styles.primaryButtonText}>
                  📐 Calculate Body Fat
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ════════════════════════════════════════
          ALL MODALS — outside ScrollView
      ════════════════════════════════════════ */}

      {/* Weight Modal */}
      <ModalSheet
        visible={showWeightModal}
        onClose={() => {
          setShowWeightModal(false)
          setSelectedLogDate(null)
        }}
        title='Log Weight'
        onConfirm={addWeight}
      >
        <TextInput
          style={styles.input}
          placeholder={`Enter weight (${weightUnit})`}
          keyboardType='decimal-pad'
          value={newWeight}
          onChangeText={setNewWeight}
        />
      </ModalSheet>

      {/* Height Modal */}
      <ModalSheet
        visible={showHeightModal}
        onClose={() => {
          setShowHeightModal(false)
          setNewHeightCm("")
          setNewHeightFt("")
          setNewHeightIn("")
        }}
        title='Set Height'
        onConfirm={saveHeight}
        confirmText='Save'
        scrollable={false}
      >
        <Text style={styles.inputLabel}>Unit:</Text>
        <View style={styles.unitToggle}>
          {["cm", "ft"].map((u: any) => (
            <TouchableOpacity
              key={u}
              style={[
                styles.unitButton,
                heightUnit === u && styles.unitButtonActive,
              ]}
              onPress={() => {
                setHeightUnit(u)
                setNewHeightCm("")
                setNewHeightFt("")
                setNewHeightIn("")
              }}
            >
              <Text
                style={[
                  styles.unitButtonText,
                  heightUnit === u && styles.unitButtonTextActive,
                ]}
              >
                {u}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {heightUnit === "cm" ? (
          <>
            <Text style={styles.inputLabel}>Height (cm)</Text>
            <TextInput
              style={styles.input}
              placeholder='e.g. 175'
              keyboardType='decimal-pad'
              value={newHeightCm}
              onChangeText={setNewHeightCm}
            />
          </>
        ) : (
          <>
            <Text style={styles.inputLabel}>Feet</Text>
            <TextInput
              style={styles.input}
              placeholder='e.g. 5'
              keyboardType='decimal-pad'
              value={newHeightFt}
              onChangeText={setNewHeightFt}
            />
            <Text style={styles.inputLabel}>Inches</Text>
            <TextInput
              style={styles.input}
              placeholder='e.g. 10'
              keyboardType='decimal-pad'
              value={newHeightIn}
              onChangeText={setNewHeightIn}
            />
          </>
        )}
      </ModalSheet>

      {/* Macros Log Modal */}
      <ModalSheet
        visible={showMacrosModal}
        onClose={() => {
          setShowMacrosModal(false)
          setSelectedLogDate(null)
        }}
        title='Log Macros'
        onConfirm={addMacrosEntry}
        scrollable={true}
      >
        <Text style={styles.inputLabel}>
          Name{" "}
          <Text style={styles.inputLabelOptional}>(e.g. "Chicken & rice")</Text>
        </Text>
        <TextInput
          style={styles.input}
          placeholder='What did you eat? (optional)'
          value={newMacrosName}
          onChangeText={setNewMacrosName}
          autoCapitalize='words'
        />
        <View style={styles.optionalDivider}>
          <View style={styles.optionalDividerLine} />
          <Text style={styles.optionalDividerText}>
            Fill in what you know — all fields below are optional
          </Text>
          <View style={styles.optionalDividerLine} />
        </View>
        <Text style={styles.inputLabel}>Calories (kcal)</Text>
        <TextInput
          style={styles.input}
          placeholder='e.g. 420'
          keyboardType='decimal-pad'
          value={newMacrosCalories}
          onChangeText={setNewMacrosCalories}
        />
        <Text style={styles.inputLabel}>Protein (g)</Text>
        <TextInput
          style={styles.input}
          placeholder='e.g. 32'
          keyboardType='decimal-pad'
          value={newMacrosProtein}
          onChangeText={setNewMacrosProtein}
        />
        <Text style={styles.inputLabel}>Carbohydrates (g)</Text>
        <TextInput
          style={styles.input}
          placeholder='e.g. 45'
          keyboardType='decimal-pad'
          value={newMacrosCarbs}
          onChangeText={setNewMacrosCarbs}
        />
        <Text style={styles.inputLabel}>Fat (g)</Text>
        <TextInput
          style={styles.input}
          placeholder='e.g. 12'
          keyboardType='decimal-pad'
          value={newMacrosFat}
          onChangeText={setNewMacrosFat}
        />
        <Text style={styles.inputLabel}>Time</Text>
        <TextInput
          style={styles.input}
          placeholder='HH:MM'
          value={newMacrosTime}
          onChangeText={setNewMacrosTime}
        />
        <Text style={styles.inputLabel}>Measurement Error (±%)</Text>
        <TextInput
          style={styles.input}
          placeholder='e.g. 5  →  ±5%'
          keyboardType='decimal-pad'
          value={newMacrosError}
          onChangeText={setNewMacrosError}
        />
        <Text style={styles.modalHint}>
          Error margin is used to calculate a min/max range for your totals
        </Text>
      </ModalSheet>

      {/* Macros Goals Modal */}
      <ModalSheet
        visible={showMacrosGoalModal}
        onClose={() => setShowMacrosGoalModal(false)}
        title='Set Daily Macros Goals'
        onConfirm={updateMacrosGoals}
        scrollable={true}
      >
        <Text style={styles.inputLabel}>Protein goal (g)</Text>
        <TextInput
          style={styles.input}
          placeholder='e.g., 150'
          keyboardType='decimal-pad'
          value={macrosGoalInput.protein}
          onChangeText={(v) =>
            setMacrosGoalInput((p: any) => ({ ...p, protein: v }))
          }
        />
        <Text style={styles.inputLabel}>Carbohydrates goal (g)</Text>
        <TextInput
          style={styles.input}
          placeholder='e.g., 250'
          keyboardType='decimal-pad'
          value={macrosGoalInput.carbs}
          onChangeText={(v) => setMacrosGoalInput((p: any) => ({ ...p, carbs: v }))}
        />
        <Text style={styles.inputLabel}>Fat goal (g)</Text>
        <TextInput
          style={styles.input}
          placeholder='e.g., 65'
          keyboardType='decimal-pad'
          value={macrosGoalInput.fat}
          onChangeText={(v) => setMacrosGoalInput((p: any) => ({ ...p, fat: v }))}
        />
        <Text style={styles.inputLabel}>Calories goal (kcal)</Text>
        <TextInput
          style={styles.input}
          placeholder='e.g., 2000'
          keyboardType='decimal-pad'
          value={macrosGoalInput.calories}
          onChangeText={(v) =>
            setMacrosGoalInput((p: any) => ({ ...p, calories: v }))
          }
        />
      </ModalSheet>

      {/* Creatine Modal */}
      <ModalSheet
        visible={showCreatineModal}
        onClose={() => setShowCreatineModal(false)}
        title='Mark Creatine Taken'
        onConfirm={markCreatineTaken}
      >
        <Text style={styles.inputLabel}>Amount (grams)</Text>
        <TextInput
          style={styles.input}
          placeholder='e.g., 5'
          keyboardType='decimal-pad'
          value={creatineGrams}
          onChangeText={setCreatineGrams}
        />
      </ModalSheet>

      {/* Body Fat Modal */}
      <ModalSheet
        visible={showBodyFatModal}
        onClose={() => {
          setShowBodyFatModal(false)
          setSelectedLogDate(null)
        }}
        title='Calculate Body Fat %'
        subtitle='US Navy Method'
        onConfirm={calculateBodyFat}
        confirmText='Calculate'
        scrollable={true}
      >
        <View style={styles.genderToggle}>
          {["male", "female"].map((g: any) => (
            <TouchableOpacity
              key={g}
              style={[
                styles.genderButton,
                gender === g && styles.genderButtonActive,
              ]}
              onPress={() => {
                setGender(g)
                AsyncStorage.setItem(getUserKey("gender"), g)
              }}
            >
              <Text
                style={[
                  styles.genderButtonText,
                  gender === g && styles.genderButtonTextActive,
                ]}
              >
                {g.charAt(0).toUpperCase() + g.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.unitToggleContainer}>
          <Text style={styles.inputLabel}>Unit:</Text>
          <View style={styles.unitToggle}>
            {["cm", "in"].map((u: any) => (
              <TouchableOpacity
                key={u}
                style={[
                  styles.unitButton,
                  measurementUnit === u && styles.unitButtonActive,
                ]}
                onPress={() => setMeasurementUnit(u)}
              >
                <Text style={styles.unitButtonText}>{u}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <Text style={styles.inputLabel}>Waist ({measurementUnit})</Text>
        <TextInput
          style={styles.input}
          placeholder='Measure at navel'
          keyboardType='decimal-pad'
          value={waist}
          onChangeText={setWaist}
        />
        <Text style={styles.inputLabel}>Neck ({measurementUnit})</Text>
        <TextInput
          style={styles.input}
          placeholder='Measure below larynx'
          keyboardType='decimal-pad'
          value={neck}
          onChangeText={setNeck}
        />
        {gender === "female" && (
          <>
            <Text style={styles.inputLabel}>Hip ({measurementUnit})</Text>
            <TextInput
              style={styles.input}
              placeholder='Measure at widest point'
              keyboardType='decimal-pad'
              value={hip}
              onChangeText={setHip}
            />
          </>
        )}
      </ModalSheet>

      {/* Creatine Location Picker */}
      <CreatineLocationPicker
        visible={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        onLocationSelected={async (location) => {
          setReminderLocation(location)
          try {
            await creatineApi.saveReminderLocation(
              location.lat,
              location.lng,
              location.address,
              location.radius,
            )
          } catch (error) {
            alert("Error", "Failed to save location", [{ text: "OK" }], "error")
          }
        }}
        initialLocation={reminderLocation}
      />

      {/* Quick Log Creatine */}
      <QuickLogCreatine
        visible={showQuickLogCreatine}
        onClose={() => {
          setShowQuickLogCreatine(false)
          setSelectedLogDate(null)
        }}
        onLog={async (grams, note) => {
          try {
            const takenAt = selectedLogDate
              ? buildLocalISOForDate(selectedLogDate, creatineTime || "09:00")
              : null
            await bodyTrackingApi.markCreatineTaken(grams, note, takenAt)
            if (!selectedLogDate || dayModal?.isToday) {
              setCreatineTakenToday(true)
            }
            setSelectedLogDate(null)
            loadData()
          } catch (error) {
            alert("Error", (error as any)?.message, [{ text: "OK" }], "error")
          }
        }}
        defaultGrams={defaultCreatineGrams}
      />

      {/* UNIFIED DAY MODAL */}
      <ModalSheet
        visible={!!dayModal}
        onClose={() => {
          setDayModal(null)
          setSelectedLogDate(null)
        }}
        showCancelButton={false}
        showConfirmButton={false}
        scrollable={true}
      >
        <View style={styles.dayModalHeader}>
          <View style={styles.dayModalIconCircle}>
            <Text style={styles.dayModalIcon}>
              {dayModal?.tab === "weight"
                ? "⚖️"
                : dayModal?.tab === "creatine"
                  ? "💊"
                  : dayModal?.tab === "macros"
                    ? "🥗"
                    : dayModal?.tab === "photos"
                      ? "📸"
                      : "📐"}
            </Text>
          </View>
          <View style={styles.dayModalHeaderText}>
            <Text style={styles.dayModalTitle}>
              {dayModal?.tab === "weight"
                ? "Weight"
                : dayModal?.tab === "creatine"
                  ? "Creatine"
                  : dayModal?.tab === "macros"
                    ? "Macros"
                    : dayModal?.tab === "photos"
                      ? "Photos"
                      : "Body Fat"}
            </Text>
            <Text style={styles.dayModalSubtitle}>
              {dayModal?.isToday
                ? "Today"
                : dayModal?.date?.toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
            </Text>
          </View>
        </View>
        <View style={styles.dayModalDivider} />

        {renderDayModalExistingEntries()}

        {(!dayModal?.existingEntries ||
          dayModal.existingEntries.length === 0) && (
          <View style={styles.dayModalEmptyState}>
            <Text style={styles.dayModalEmptyIcon}>
              {dayModal?.tab === "weight"
                ? "⚖️"
                : dayModal?.tab === "creatine"
                  ? "💊"
                  : dayModal?.tab === "macros"
                    ? "🥗"
                    : dayModal?.tab === "photos"
                      ? "📸"
                      : "📐"}
            </Text>
            <Text style={styles.dayModalEmptyText}>
              No entries for this day
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.logEntryBtn}
          onPress={() => openLogModalForTab(dayModal?.tab)}
        >
          <Text style={styles.logEntryBtnText}>
            {dayModal?.tab === "weight"
              ? "⚖️ Log Weight"
              : dayModal?.tab === "creatine"
                ? "💊 Log Creatine"
                : dayModal?.tab === "macros"
                  ? "🥗 Log Macros"
                  : dayModal?.tab === "photos"
                    ? "📸 Add Photo"
                    : "📐 Calculate Body Fat"}
          </Text>
        </TouchableOpacity>
      </ModalSheet>

      {/* Fullscreen Photo Viewer */}
      <ModalSheet
        visible={!!expandedPhoto}
        onClose={() => setExpandedPhoto(null)}
      >
        <View style={styles.photoViewerOverlay}>
          <TouchableOpacity
            style={styles.photoViewerClose}
            onPress={() => setExpandedPhoto(null)}
          >
            <Text style={styles.photoViewerCloseText}>✕</Text>
          </TouchableOpacity>
          {expandedPhoto && (
            <Image
              source={{ uri: expandedPhoto.uri }}
              style={styles.photoViewerImage}
              resizeMode='contain'
            />
          )}
          {expandedPhoto?.photo && (
            <View style={styles.photoViewerInfo}>
              <Text style={styles.photoViewerTime}>
                {new Date(expandedPhoto.photo.takenAt).toLocaleDateString(
                  "en-US",
                  { weekday: "long", month: "long", day: "numeric" },
                )}
                {"  ·  "}
                {new Date(expandedPhoto.photo.takenAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
              {expandedPhoto.photo.note && (
                <Text style={styles.photoViewerNote}>
                  {expandedPhoto.photo.note}
                </Text>
              )}
            </View>
          )}
        </View>
      </ModalSheet>

      {/* Custom Alert */}
      {AlertComponent}
    </SafeAreaView>
  )
}

// ═══════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  content: { padding: 20, paddingTop: 60, paddingBottom: 120 },
  header: { marginBottom: 25, alignItems: "center" },
  title: { fontSize: 32, fontWeight: "bold", color: "#333", marginBottom: 8 },
  subtitle: { fontSize: 16, color: "#666", textAlign: "center" },

  weightHistoryCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 15,
  },
  weightHistoryTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  weightEntryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  weightEntryRowBorder: { borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  weightEntryDate: { fontSize: 14, fontWeight: "500", color: "#333" },
  weightEntryTime: { fontSize: 12, color: "#999", marginTop: 2 },
  weightEntryRight: { alignItems: "flex-end" },
  weightEntryValueRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  weightEntryValue: { fontSize: 16, fontWeight: "600", color: "#555" },
  weightEntryValueLatest: { color: "#667eea", fontSize: 18 },
  weightEntryLatestBadge: {
    fontSize: 11,
    color: "#667eea",
    fontWeight: "600",
    marginTop: 2,
  },
  deleteEntryBtn: { padding: 4, opacity: 0.55 },
  deleteEntryBtnText: { fontSize: 15 },
  loadMoreButton: {
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#f0f3ff",
    alignItems: "center",
  },
  loadMoreText: { fontSize: 14, color: "#667eea", fontWeight: "600" },

  trendContainer: { marginTop: 12, alignItems: "center" },
  trendBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  trendUp: { backgroundColor: "#fee2e2" },
  trendDown: { backgroundColor: "#dcfce7" },
  trendStable: { backgroundColor: "#f3f4f6" },
  trendIcon: { fontSize: 16, fontWeight: "bold" },
  trendText: { fontSize: 14, fontWeight: "600", color: "#333" },
  trendPercent: { fontSize: 12, color: "#666" },
  trendSubtext: { fontSize: 11, color: "#999", marginTop: 4 },
  trendSelector: {
    flexDirection: "row",
    marginTop: 12,
    gap: 8,
    backgroundColor: "#f9fafb",
    padding: 4,
    borderRadius: 10,
  },
  trendOption: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  trendOptionActive: { backgroundColor: "#667eea" },
  trendOptionText: { fontSize: 13, fontWeight: "600", color: "#666" },
  trendOptionTextActive: { color: "#fff" },

  tabContainer: { marginBottom: 20 },
  tab: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginRight: 10,
    borderRadius: 12,
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
  },
  tabActive: { backgroundColor: "#667eea" },
  tabIcon: { fontSize: 20, marginRight: 8 },
  tabLabel: { fontSize: 14, fontWeight: "600", color: "#666" },
  tabLabelActive: { color: "#fff" },

  section: { marginBottom: 25 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  sectionTitle: { fontSize: 20, fontWeight: "bold", color: "#333" },

  statsCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    marginBottom: 15,
    alignItems: "center",
  },
  statsTitle: { fontSize: 14, color: "#666", marginBottom: 8 },
  statsValue: { fontSize: 36, fontWeight: "bold", color: "#667eea" },
  statsDate: { fontSize: 13, color: "#999", marginTop: 4 },

  buttonRow: { flexDirection: "row", gap: 10, marginBottom: 15 },
  primaryButton: {
    flex: 1,
    backgroundColor: "#667eea",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  primaryButtonDisabled: { backgroundColor: "#d1d5db" },
  primaryButtonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  secondaryButton: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#667eea",
  },
  secondaryButtonText: { color: "#667eea", fontWeight: "700", fontSize: 15 },
  goalButton: {
    backgroundColor: "#f0f3ff",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  goalButtonText: { color: "#667eea", fontWeight: "600", fontSize: 14 },

  creatineStatsCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 15,
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  statLabel: { fontSize: 15, color: "#666" },
  statValue: { fontSize: 15, fontWeight: "600", color: "#333" },

  macrosStatsCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 15,
  },
  macrosStatsTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 16,
  },
  macroRow: { marginBottom: 16 },
  macroLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  macroLabel: { fontSize: 14, color: "#666", fontWeight: "500" },
  macroValue: { fontSize: 14, fontWeight: "700", color: "#333" },
  macroRange: { fontSize: 12, color: "#999", fontWeight: "normal" },
  macroProgressBar: {
    height: 10,
    backgroundColor: "#f0f0f0",
    borderRadius: 5,
    overflow: "hidden",
  },
  macroProgressFill: { height: "100%", borderRadius: 5 },
  macroProgressText: { fontSize: 11, color: "#999", marginTop: 3 },
  macrosEntriesCount: {
    fontSize: 13,
    color: "#999",
    textAlign: "center",
    marginTop: 4,
  },

  bodyFatCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    marginBottom: 15,
  },
  bodyFatLabel: { fontSize: 14, color: "#666", marginBottom: 8 },
  bodyFatValue: {
    fontSize: 48,
    fontWeight: "bold",
    color: "#667eea",
    marginBottom: 4,
  },
  bodyFatDate: { fontSize: 13, color: "#999" },
  bodyFatMethod: {
    fontSize: 12,
    color: "#999",
    marginTop: 8,
    fontStyle: "italic",
  },
  bodyFatDeleteBtn: {
    marginTop: 16,
    backgroundColor: "#fee2e2",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  bodyFatDeleteBtnText: { fontSize: 13, color: "#dc2626", fontWeight: "600" },

  emptyState: {
    alignItems: "center",
    padding: 40,
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 15,
  },
  emptyText: { fontSize: 16, color: "#999" },

  inputLabel: { fontSize: 13, color: "#555", marginBottom: 4, marginTop: 8 },
  inputLabelOptional: { fontSize: 12, color: "#aaa", fontWeight: "normal" },
  input: {
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  modalHint: {
    fontSize: 13,
    color: "#999",
    marginBottom: 15,
    textAlign: "center",
  },

  genderToggle: { flexDirection: "row", gap: 10, marginBottom: 15 },
  genderButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#f0f0f0",
    alignItems: "center",
  },
  genderButtonActive: { backgroundColor: "#667eea" },
  genderButtonText: { color: "#666", fontWeight: "600" },
  genderButtonTextActive: { color: "#fff" },

  unitToggleContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
  },
  unitToggle: {
    flexDirection: "row",
    marginLeft: "auto",
    backgroundColor: "#f0f0f0",
    borderRadius: 8,
    padding: 2,
  },
  unitButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  unitButtonActive: { backgroundColor: "#667eea" },
  unitButtonText: { color: "#666", fontWeight: "600", fontSize: 12 },
  unitButtonTextActive: { color: "#fff" },

  optionalDivider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 12,
    gap: 8,
  },
  optionalDividerLine: { flex: 1, height: 1, backgroundColor: "#e5e7eb" },
  optionalDividerText: {
    fontSize: 11,
    color: "#9ca3af",
    textAlign: "center",
    flexShrink: 1,
  },

  photoGroupContainer: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  photoGroupDate: {
    fontSize: 13,
    fontWeight: "600",
    color: "#555",
    marginBottom: 8,
  },
  photoGroupRow: { flexDirection: "row" },
  photoThumbWrap: { marginRight: 10, position: "relative" },
  photoThumb: { width: 110, height: 140, borderRadius: 10 },
  photoThumbLoading: {
    backgroundColor: "#e8eaf6",
    alignItems: "center",
    justifyContent: "center",
  },
  photoThumbError: {
    backgroundColor: "#fee2e2",
    alignItems: "center",
    justifyContent: "center",
  },
  photoThumbDelete: {
    position: "absolute",
    top: 5,
    right: 5,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  photoThumbDeleteText: { color: "#fff", fontSize: 10, fontWeight: "700" },

  existingEntriesSection: {
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
    marginBottom: 4,
  },
  existingEntriesTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#888",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  existingEntryRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    gap: 10,
  },
  existingEntryTime: { fontSize: 12, color: "#999", minWidth: 44 },
  existingEntryValue: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
  },
  existingEntryName: { fontSize: 14, fontWeight: "700", color: "#333" },
  existingEntryMacros: { fontSize: 12, color: "#666", marginTop: 2 },
  existingEntryNote: {
    fontSize: 12,
    color: "#888",
    fontStyle: "italic",
    flex: 1,
  },
  existingEntryDelete: { fontSize: 17, opacity: 0.55 },

  logEntryBtn: {
    marginTop: 20,
    backgroundColor: "#667eea",
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    shadowColor: "#667eea",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  logEntryBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },

  dayModalEmptyState: { alignItems: "center", paddingVertical: 32 },
  dayModalEmptyIcon: { fontSize: 40, marginBottom: 10, opacity: 0.3 },
  dayModalEmptyText: { fontSize: 15, color: "#bbb" },

  dayModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  dayModalCard: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 16,
  },
  dayModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    paddingBottom: 16,
    gap: 12,
  },
  dayModalIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#f0f3ff",
    alignItems: "center",
    justifyContent: "center",
  },
  dayModalIcon: { fontSize: 22 },
  dayModalHeaderText: { flex: 1 },
  dayModalTitle: { fontSize: 18, fontWeight: "700", color: "#1a1a2e" },
  dayModalSubtitle: { fontSize: 13, color: "#888", marginTop: 2 },
  dayModalDivider: {
    height: 1,
    backgroundColor: "#f0f0f0",
    marginHorizontal: 20,
  },

  heightCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 15,
    borderWidth: 2,
    borderColor: "#e8eaf6",
  },
  heightDisplay: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  heightInfo: { flex: 1 },
  heightLabel: { fontSize: 13, color: "#666", marginBottom: 4 },
  heightValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#667eea",
    marginBottom: 4,
  },
  heightNote: { fontSize: 12, color: "#999", fontStyle: "italic" },
  heightEditButton: {
    backgroundColor: "#667eea",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  heightEditButtonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  heightSetButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#fef3c7",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#fbbf24",
    borderStyle: "dashed",
  },
  heightSetIcon: { fontSize: 32, marginRight: 12 },
  heightSetTextContainer: { flex: 1 },
  heightSetTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#92400e",
    marginBottom: 4,
  },
  heightSetSubtitle: { fontSize: 13, color: "#92400e" },

  photoViewerOverlay: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  photoViewerClose: {
    position: "absolute",
    top: 54,
    right: 20,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  photoViewerCloseText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  photoViewerImage: { width, height: SCREEN_HEIGHT * 0.8 },
  photoViewerInfo: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingVertical: 20,
    paddingHorizontal: 24,
    paddingBottom: 36,
  },
  photoViewerTime: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
  },
  photoViewerNote: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 13,
    textAlign: "center",
    marginTop: 4,
    fontStyle: "italic",
  },
})
