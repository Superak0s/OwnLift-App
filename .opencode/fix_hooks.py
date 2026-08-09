import re

filepath = r'C:\Users\Superak0s\Documents\Coding\OwnLift\OwnLift-App\src\features\tracking\TrackingScreen.tsx'

with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Replace lines 181-315 (0-indexed: 180-314) - from "// ── TAB HOOKS" to end of useEffect
start = 180  # line 181 (the comment block before TAB HOOKS)
end = 325    # line 326 (the useEffect for loadAllData)

# Find actual boundaries
for i in range(178, 185):
    if "───" in lines[i] and "TAB HOOKS" in lines[i+1]:
        start = i
        break
for i in range(320, 330):
    if "}, [loadAllData]);" in lines[i]:
        end = i + 1
        break

replacement = r'''
  // ─────────────────────────────────────────────────────────────
  // TAB HOOKS — extracted state, handlers (data loading is screen-level)
  // ─────────────────────────────────────────────────────────────
  const loadDataRef = useRef<() => Promise<void> | void>(() => {});

  const _weight = useWeightTab({ alert, loadData: loadDataRef.current, setDayModal: setDayModal as any, selectedLogDate, setSelectedLogDate, buildLocalISOForDate, user });
  const _macros = useMacrosTab({ alert, loadData: loadDataRef.current, setDayModal: setDayModal as any, selectedLogDate, setSelectedLogDate });
  const _bodyFat = useBodyFatTab({ alert, loadData: loadDataRef.current, setDayModal: setDayModal as any, selectedLogDate, setSelectedLogDate, height: _weight.height, getUserKey });
  const _photos = usePhotosTab({ alert, loadData: loadDataRef.current as any, setDayModal: setDayModal as any, selectedLogDate, setSelectedLogDate, authToken: null, activeTab });
  const _measurements = useMeasurementsTab({ alert, loadTabData: loadDataRef.current as any, setDayModal: setDayModal as any, selectedLogDate, setSelectedLogDate, buildLocalISOForDate, activeTab });
  const _hydration = useHydrationTab({ alert, loadTabData: loadDataRef.current as any, setDayModal: setDayModal as any, selectedLogDate, setSelectedLogDate, buildLocalISOForDate, activeTab });
  const _soreness = useSorenessTab({ alert, loadTabData: loadDataRef.current as any, setDayModal: setDayModal as any, activeTab });
  const _menstrual = useMenstrualTab({ alert, loadFromServer: loadDataRef.current as any, user });

  // Adapters — normalize hook returns to names the JSX expects
  const weight = {
    history: _weight.weightHistory, setHistory: _weight.setWeightHistory,
    weightUnit: _weight.weightUnit, setWeightUnit: _weight.setWeightUnit,
    showWeightModal: _weight.showWeightModal, openWeightModal: _weight.openWeightModal, closeWeightModal: () => _weight.setShowWeightModal(false),
    newWeight: _weight.newWeight, setNewWeight: _weight.setNewWeight,
    entriesShown: _weight.weightEntriesShown, setEntriesShown: _weight.setWeightEntriesShown,
    trendAverageDays: _weight.trendAverageDays, setTrendAverageDays: _weight.setTrendAverageDays,
    trend: _weight.getWeightTrend(),
    chartData: _weight.getWeightChartData(),
    loadMoreEntries: _weight.loadMoreWeightEntries,
    deleteWeightEntry: _weight.deleteWeightEntry,
    addWeight: _weight.addWeight,
    hasDataOnDate: _weight.hasWeightData,
    height: _weight.height, setHeight: _weight.setHeight,
    heightUnit: _weight.heightUnit, setHeightUnit: _weight.setHeightUnit,
    showHeightModal: _weight.showHeightModal, openHeightModal: () => _weight.setShowHeightModal(true), closeHeightModal: () => _weight.setShowHeightModal(false),
    newHeightCm: _weight.newHeightCm, setNewHeightCm: _weight.setNewHeightCm,
    newHeightFt: _weight.newHeightFt, setNewHeightFt: _weight.setNewHeightFt,
    newHeightIn: _weight.newHeightIn, setNewHeightIn: _weight.setNewHeightIn,
  };

  const macros = {
    entries: _macros.macrosEntries, setEntries: _macros.setMacrosEntries,
    goals: _macros.dailyMacrosGoals, setGoals: _macros.setDailyMacrosGoals,
    showMacrosModal: _macros.showMacrosModal, openMacrosModal: _macros.openMacrosModal, closeMacrosModal: () => _macros.setShowMacrosModal(false),
    showMacrosGoalModal: _macros.showMacrosGoalModal, openGoalModal: () => _macros.setShowMacrosGoalModal(true), closeGoalModal: () => _macros.setShowMacrosGoalModal(false),
    newName: _macros.newMacrosName, setNewName: _macros.setNewMacrosName,
    newCalories: _macros.newMacrosCalories, setNewCalories: _macros.setNewMacrosCalories,
    newProtein: _macros.newMacrosProtein, setNewProtein: _macros.setNewMacrosProtein,
    newCarbs: _macros.newMacrosCarbs, setNewCarbs: _macros.setNewMacrosCarbs,
    newFat: _macros.newMacrosFat, setNewFat: _macros.setNewMacrosFat,
    newTime: _macros.newMacrosTime, setNewTime: _macros.setNewMacrosTime,
    newError: _macros.newMacrosError, setNewError: _macros.setNewMacrosError,
    goalsInput: _macros.macrosGoalInput, setGoalsInput: _macros.setMacrosGoalInput,
    deleteMacroEntry: _macros.deleteMacroEntry,
    addMacrosEntry: _macros.addMacrosEntry,
    updateMacrosGoals: _macros.updateMacrosGoals,
    dailyStats: _macros.getDailyMacrosStats(new Date()),
    hasDataOnDate: _macros.hasMacrosData,
  };

  const bodyFat = {
    history: _bodyFat.bodyFatHistory, setHistory: _bodyFat.setBodyFatHistory,
    height: _weight.height,
    heightUnit: _weight.heightUnit, setHeightUnit: _weight.setHeightUnit,
    showHeightModal: _weight.showHeightModal, openHeightModal: () => _weight.setShowHeightModal(true), closeHeightModal: () => _weight.setShowHeightModal(false),
    newHeightCm: _weight.newHeightCm, setNewHeightCm: _weight.setNewHeightCm,
    newHeightFt: _weight.newHeightFt, setNewHeightFt: _weight.setNewHeightFt,
    newHeightIn: _weight.newHeightIn, setNewHeightIn: _weight.setNewHeightIn,
    showBodyFatModal: _bodyFat.showBodyFatModal, openBodyFatModal: _bodyFat.openBodyFatModal, closeBodyFatModal: () => _bodyFat.setShowBodyFatModal(false),
    gender: _bodyFat.gender, setGender: _bodyFat.setGender,
    waist: _bodyFat.waist, setWaist: _bodyFat.setWaist,
    neck: _bodyFat.neck, setNeck: _bodyFat.setNeck,
    hip: _bodyFat.hip, setHip: _bodyFat.setHip,
    measurementUnit: _bodyFat.measurementUnit, setMeasurementUnit: _bodyFat.setMeasurementUnit,
    deleteBodyFatEntry: _bodyFat.deleteBodyFatEntry,
    calculateBodyFat: _bodyFat.calculateBodyFat,
    saveHeight: _weight.addWeight,
    hasDataOnDate: _bodyFat.hasBodyFatData,
  };

  const photos = {
    entries: _photos.progressPhotos, setEntries: _photos.setProgressPhotos,
    photoUriCache: _photos.photoUriCache,
    deletePhoto: _photos.deletePhoto,
    hasDataOnDate: _photos.hasPhotosData ?? ((date: Date) => false),
  };

  const measurements = {
    history: _measurements.measurementHistory, setHistory: _measurements.setMeasurementHistory,
    customEntries: _measurements.customMeasurementEntries, setCustomEntries: _measurements.setCustomMeasurementEntries,
    showMeasurementModal: _measurements.showMeasurementModal, openMeasurementModal: () => _measurements.setShowMeasurementModal(true), closeMeasurementModal: () => _measurements.setShowMeasurementModal(false),
    newWaist: _measurements.newWaist, setNewWaist: _measurements.setNewWaist,
    newArmLeft: _measurements.newArmLeft, setNewArmLeft: _measurements.setNewArmLeft,
    newArmRight: _measurements.newArmRight, setNewArmRight: _measurements.setNewArmRight,
    newChest: _measurements.newChest, setNewChest: _measurements.setNewChest,
    newCustomBodyPart: _measurements.newCustomBodyPart, setNewCustomBodyPart: _measurements.setNewCustomBodyPart,
    newCustomBodyPartValue: _measurements.newCustomBodyPartValue, setNewCustomBodyPartValue: _measurements.setNewCustomBodyPartValue,
    deleteMeasurementEntry: _measurements.deleteMeasurementEntry,
    handleLogMeasurement: _measurements.handleLogMeasurement,
    hasDataOnDate: _measurements.hasMeasurementsData,
  };

  const hydration = {
    entries: _hydration.hydrationEntries, setEntries: _hydration.setHydrationEntries,
    goal: _hydration.hydrationGoal, setGoal: _hydration.setHydrationGoal,
    showHydrationModal: _hydration.showHydrationModal, openHydrationModal: () => _hydration.setShowHydrationModal(true), closeHydrationModal: () => _hydration.setShowHydrationModal(false),
    newAmount: _hydration.newHydrationAmount, setNewAmount: _hydration.setNewHydrationAmount,
    deleteHydrationEntry: _hydration.deleteHydrationEntry,
    handleLogHydration: _hydration.handleLogHydration,
    hasDataOnDate: _hydration.hasHydrationData,
  };

  const soreness = {
    entries: _soreness.sorenessEntries, setEntries: _soreness.setSorenessEntries,
    openSorenessModal: modalState.openSorenessModal,
    deleteSorenessEntry: _soreness.deleteSorenessEntry,
    hasDataOnDate: _soreness.hasSorenessData,
  };

  const menstrual = {
    entries: _menstrual.cycleEntries, setEntries: _menstrual.setCycleEntries,
    prefs: _menstrual.menstrualPrefs, setPrefs: _menstrual.setMenstrualPrefs,
    actualDays: _menstrual.cycleActualDays,
    predictedDays: _menstrual.cyclePredictedDays, setPredictedDays: _menstrual.setCyclePredictedDays,
    openCycleModal: modalState.openCycleModal,
    hasDataOnDate: _menstrual.hasCycleData,
  };

  // ─────────────────────────────────────────────────────────────
  // WIDGET BOARDS
  // ─────────────────────────────────────────────────────────────

'''

new_lines = lines[:start] + [replacement] + lines[end:]

with open(filepath, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print(f'Replaced lines {start+1}-{end} ({len(lines)} -> {len(new_lines)} lines)')
