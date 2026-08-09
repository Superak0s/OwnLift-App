filepath = r'C:\Users\Superak0s\Documents\Coding\OwnLift\OwnLift-App\src\features\tracking\TrackingScreen.tsx'

with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find line after "WIDGET BOARDS" comment block (line 308-309)
insert_after = None
for i, line in enumerate(lines):
    if "WIDGET BOARDS" in line:
        # Find the end of the comment block
        for j in range(i+1, min(i+5, len(lines))):
            if lines[j].strip() == "":
                insert_after = j
                break
        break

# Find the useEffect with loadAllData
useEffect_start = None
useEffect_end = None
for i, line in enumerate(lines):
    if "useEffect(() => {" in line and "loadAllData" in lines[i+1]:
        useEffect_start = i
        for j in range(i, min(i+5, len(lines))):
            if "}, [loadAllData]);" in lines[j]:
                useEffect_end = j + 1
                break

# Find openLogModalForTab
handler_start = None
for i, line in enumerate(lines):
    if "openLogModalForTab" in line:
        handler_start = i - 2  # go back to comment
        break

replacement_widget_boards = r'''
  const weightBoard = useWidgets<WeightWidgetType>({
    registry: WEIGHT_WIDGET_REGISTRY,
    defaultWidgets: DEFAULT_WEIGHT_WIDGETS,
    storageKey: WEIGHT_WIDGETS_STORAGE_KEY,
  });
  const photosBoard = useWidgets<PhotosWidgetType>({
    registry: PHOTOS_WIDGET_REGISTRY,
    defaultWidgets: DEFAULT_PHOTOS_WIDGETS,
    storageKey: PHOTOS_WIDGETS_STORAGE_KEY,
  });
  const macrosBoard = useWidgets<MacrosWidgetType>({
    registry: MACROS_WIDGET_REGISTRY,
    defaultWidgets: DEFAULT_MACROS_WIDGETS,
    storageKey: MACROS_WIDGETS_STORAGE_KEY,
  });
  const bodyFatBoard = useWidgets<BodyFatWidgetType>({
    registry: BODYFAT_WIDGET_REGISTRY,
    defaultWidgets: DEFAULT_BODYFAT_WIDGETS,
    storageKey: BODYFAT_WIDGETS_STORAGE_KEY,
  });
  const measurementsBoard = useWidgets<MeasurementsWidgetType>({
    registry: MEASUREMENTS_WIDGET_REGISTRY,
    defaultWidgets: DEFAULT_MEASUREMENTS_WIDGETS,
    storageKey: MEASUREMENTS_WIDGETS_STORAGE_KEY,
  });
  const hydrationBoard = useWidgets<HydrationWidgetType>({
    registry: HYDRATION_WIDGET_REGISTRY,
    defaultWidgets: DEFAULT_HYDRATION_WIDGETS,
    storageKey: HYDRATION_WIDGETS_STORAGE_KEY,
  });
  const sorenessBoard = useWidgets<SorenessWidgetType>({
    registry: SORENESS_WIDGET_REGISTRY,
    defaultWidgets: DEFAULT_SORENESS_WIDGETS,
    storageKey: SORENESS_WIDGETS_STORAGE_KEY,
  });
  const menstrualBoard = useWidgets<MenstrualWidgetType>({
    registry: MENSTRUAL_WIDGET_REGISTRY,
    defaultWidgets: DEFAULT_MENSTRUAL_WIDGETS,
    storageKey: MENSTRUAL_WIDGETS_STORAGE_KEY,
  });

  const boardMap: Record<string, any> = {
    weight: weightBoard,
    photos: photosBoard,
    macros: macrosBoard,
    bodyfat: bodyFatBoard,
    measurements: measurementsBoard,
    hydration: hydrationBoard,
    soreness: sorenessBoard,
    menstrual: menstrualBoard,
  };
  const activeBoard = boardMap[activeTab] ?? weightBoard;
  const activeRegistry = registryMap[activeTab]?.registry ?? WEIGHT_WIDGET_REGISTRY;

  // ─────────────────────────────────────────────────────────────
  // DATA LOADING — screen fetches from APIs, distributes to hooks
  // ─────────────────────────────────────────────────────────────

  const loadAllData = useCallback(async () => {
    try {
      const [weightRes, macrosRes, bodyFatRes, photosRes, measRes, hydRes, sorRes, menRes] = await Promise.all([
        bodyTrackingApi.getWeightEntries(user.id),
        macrosTrackingApi.getMacrosEntries(user.id),
        bodyFatApi.getBodyFatEntries(user.id),
        (async () => { const r = await authenticatedFetch(`${config.apiUrl}/api/photos`, { headers: await tokenStorage.getAuthHeaders() }); return r.ok ? r.json() : []; })(),
        bodyMeasurementsApi.getMeasurementEntries(user.id),
        hydrationApi.getHydrationEntries(user.id),
        sorenessApi.getSorenessEntries(user.id),
        menstrualApi.getCycleEntries(user.id),
      ]);
      _weight.setWeightHistory(Array.isArray(weightRes) ? weightRes : []);
      _macros.setMacrosEntries(Array.isArray(macrosRes) ? macrosRes : []);
      _bodyFat.setBodyFatHistory(Array.isArray(bodyFatRes) ? bodyFatRes : []);
      _photos.setProgressPhotos(Array.isArray(photosRes) ? photosRes : []);
      _measurements.setMeasurementHistory(Array.isArray(measRes) ? measRes : []);
      _hydration.setHydrationEntries(Array.isArray(hydRes) ? hydRes : []);
      _soreness.setSorenessEntries(Array.isArray(sorRes) ? sorRes : []);
      _menstrual.setCycleEntries(Array.isArray(menRes) ? menRes : []);
    } catch {
      // silent fail - data stale from previous load
    }
  }, [user.id]);

  // Wire loadDataRef after hooks are created (circular dep workaround)
  useEffect(() => {
    loadDataRef.current = loadAllData;
  });

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // ─────────────────────────────────────────────────────────────
  // HANDLERS
  // ─────────────────────────────────────────────────────────────

'''

# Insert widget boards + data loading after WIDGET BOARDS comment
new_lines = lines[:insert_after+1] + [replacement_widget_boards] + lines[useEffect_end:handler_start] + [
    "  const openLogModalForTab = useCallback(\n",
    "    (tab: string) => {\n",
    "      switch (tab) {\n",
    '        case "weight": weight.openWeightModal(); break;\n',
    '        case "macros": macros.openMacrosModal(); break;\n',
    '        case "bodyfat": bodyFat.openBodyFatModal(); break;\n',
    '        case "measurements": measurements.openMeasurementModal(); break;\n',
    '        case "hydration": hydration.openHydrationModal(); break;\n',
    '        case "soreness": modalState.openSorenessModal(); break;\n',
    '        case "menstrual": modalState.openCycleModal(); break;\n',
    '        case "photos": photos.deletePhoto; break;\n',  # placeholder - photos uses image picker\n',
    '        default: weight.openWeightModal();\n',
    "      }\n",
    "    },\n",
    "    [weight, macros, bodyFat, hydration, modalState],\n",
    "  );\n",
] + lines[handler_start+16:]

with open(filepath, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print(f'Done: {len(lines)} -> {len(new_lines)} lines')
