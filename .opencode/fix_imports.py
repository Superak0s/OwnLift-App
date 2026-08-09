import re

filepath = r'C:\Users\Superak0s\Documents\Coding\OwnLift\OwnLift-App\src\features\tracking\TrackingScreen.tsx'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Fix makeStyles import (default export)
content = content.replace('import { makeStyles } from "./styles";', 'import makeStyles from "./styles";')

# 2. Fix ProgressPhoto import
content = content.replace('import type { ProgressPhoto } from "@models/ProgressPhoto";', 'import type { ProgressPhoto } from "@shared/types";')

# 3. Remove saveToStorage, STORAGE_KEYS from imports (they don't exist in ./tabs)
content = content.replace('  saveToStorage,\n  STORAGE_KEYS,\n', '')

# 4. Add buildLocalISOForDate to utils import
content = content.replace(
    'import { toLocalDateStr, getCycleStartIso, getCycleDuration, getCycleFlowLabel, getUserKey } from "./utils";',
    'import { toLocalDateStr, getCycleStartIso, getCycleDuration, getCycleFlowLabel, getUserKey, buildLocalISOForDate, isoToLocalDateStr, computeUpcomingPredictedDays, getCyclePhaseLabel, formatDateLabel } from "./utils";'
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print('Import fixes applied')
