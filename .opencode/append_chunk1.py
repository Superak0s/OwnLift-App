import sys

chunk1 = r'''soreness.deleteSorenessEntry(entry)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.existingEntryDelete}>🗑</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      );
    }

    return null;
  };

  const renderWidgetContent = (instance: WidgetInstance<string>): React.ReactNode => {
    switch (instance.type) {
      case "weight_overview": {
        return weight.history.length > 0 ? (
          <View style={styles.statsCard}>
            <Text style={styles.statsTitle}>Current Weight</Text>
            <Text style={styles.statsValue}>
              {weight.weightUnit === "kg"
                ? `${Number(weight.history[0].weight_kg).toFixed(1)} kg`
                : `${(Number(weight.history[0].weight_kg) * 2.20462).toFixed(1)} lbs`}
            </Text>
            <Text style={styles.statsDate}>
              {new Date(weight.history[0].recorded_at).toLocaleDateString()}
            </Text>
            {weight.trend && (
              <View style={styles.trendContainer}>
                <View style={[styles.trendBadge, weight.trend.direction === "up" ? styles.trendUp : weight.trend.direction === "down" ? styles.trendDown : styles.trendStable]}>
                  <Text style={styles.trendIcon}>{weight.trend.direction === "up" ? "↗" : weight.trend.direction === "down" ? "↘" : "→"}</Text>
                  <Text style={styles.trendText}>{Math.abs(weight.trend.diff).toFixed(1)} {weight.weightUnit}</Text>
                  <Text style={styles.trendPercent}>({weight.trend.percentChange > 0 ? "+" : ""}{weight.trend.percentChange.toFixed(1)}%)</Text>
                </View>
                <Text style={styles.trendSubtext}>vs. {weight.trend.daysCompared}-day average</Text>
                <View style={styles.trendSelector}>
                  {[3, 7, 14, 30].map((days: number) => (
                    <TouchableOpacity key={days} style={[styles.trendOption, weight.trendAverageDays === days && styles.trendOptionActive]} onPress={() => weight.setTrendAverageDays(days)}>
                      <Text style={[styles.trendOptionText, weight.trendAverageDays === days && styles.trendOptionTextActive]}>{days}d</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
            <TouchableOpacity style={styles.primaryButton} onPress={() => { setSelectedLogDate(null); weight.openWeightModal(); }}>
              <Text style={styles.primaryButtonText}>+ Log Weight</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No weight data logged yet</Text>
            <TouchableOpacity style={styles.primaryButton} onPress={() => { setSelectedLogDate(null); weight.openWeightModal(); }}>
              <Text style={styles.primaryButtonText}>+ Log Weight</Text>
            </TouchableOpacity>
          </View>
        );
      }

      case "weight_calendar":
        return <UniversalCalendar hasDataOnDate={weight.hasDataOnDate} onDatePress={(date: Date) => handleCalendarDatePress(date, "weight")} initialView="week" legendText="Weight logged · tap any day to view/add" dotColor="#667eea" />;

      case "weight_history": {
        if (weight.history.length === 0) return <Text style={styles.widgetLineMuted}>Log a weight entry to see your history here.</Text>;
        return (
          <View>
            {weight.history.slice(0, weight.entriesShown).map((entry, index) => {
              const val = weight.weightUnit === "kg" ? `${Number(entry.weight_kg).toFixed(1)} kg` : `${(Number(entry.weight_kg) * 2.20462).toFixed(1)} lbs`;
              const isLatest = index === 0;
              return (
                <View key={entry.id ?? index} style={[styles.weightEntryRow, index === weight.history.slice(0, weight.entriesShown).length - 1 && styles.weightEntryRowBorder]}>
                  <View>
                    <Text style={styles.weightEntryDate}>{new Date(entry.recorded_at).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}</Text>
                    <Text style={styles.weightEntryTime}>{new Date(entry.recorded_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Text>
                  </View>
                  <View style={styles.weightEntryRight}>
                    <View style={styles.weightEntryValueRow}>
                      <Text style={[styles.weightEntryValue, isLatest && styles.weightEntryValueLatest]}>{val}</Text>
                      <TouchableOpacity style={styles.deleteEntryBtn} onPress={() => weight.deleteWeightEntry(entry)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Text style={styles.deleteEntryBtnText}>🗑</Text>
                      </TouchableOpacity>
                    </View>
                    {isLatest && <Text style={styles.weightEntryLatestBadge}>latest</Text>}
                  </View>
                </View>
              );
            })}
            {weight.entriesShown < weight.history.length && (
              <TouchableOpacity style={styles.loadMoreButton} onPress={weight.loadMoreEntries}>
                <Text style={styles.loadMoreText}>View More ({weight.history.length - weight.entriesShown} more)</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      }

      case "weight_chart": {
        if (weight.history.length <= 1) return <Text style={styles.widgetLineMuted}>Log at least two weight entries to see a trend chart here.</Text>;
        return <ProgressChart title="Weight Trend" icon="📈" data={weight.chartData} yAxisSuffix={weight.weightUnit} />;
      }

      case "photos_calendar":
        return <PhotosCalendarWidget />;

      case "photos_gallery":
        return <PhotosGalleryWidget />;

      case "macros_calendar":
        return <UniversalCalendar hasDataOnDate={macros.hasDataOnDate} onDatePress={(date: Date) => handleCalendarDatePress(date, "macros")} initialView="week" legendText="Macros logged · tap any day to view/add" dotColor="#ef4444" />;

      case "macros_today": {
        const todayStats = macros.dailyStats;
        return (
          <View>
            <TouchableOpacity style={styles.goalButton} onPress={macros.openGoalModal}>
              <Text style={styles.goalButtonText}>{macros.goals.calories} kcal goal</Text>
            </TouchableOpacity>
            {todayStats ? (
              <View style={styles.macrosStatsCard}>
                <Text style={styles.macrosStatsTitle}>Today's Intake</Text>
                {([
                  { key: "calories", label: "Calories", unit: "kcal", color: colors.warning },
                  { key: "protein", label: "Protein", unit: "g", color: colors.accent },
                  { key: "carbs", label: "Carbs", unit: "g", color: colors.success },
                  { key: "fat", label: "Fat", unit: "g", color: colors.error },
                ] as const).filter(({ key }) => todayStats[key] != null).map(({ key, label, unit, color }) => {
                  const macro = todayStats[key]!;
                  return (
                    <View key={key} style={styles.macroRow}>
                      <View style={styles.macroLabelRow}>
                        <Text style={styles.macroLabel}>{label}</Text>
                        <Text style={styles.macroValue}>{macro.total.toFixed(0)}{unit} <Text style={styles.macroRange}> ({macro.min.toFixed(0)}–{macro.max.toFixed(0)})</Text></Text>
                      </View>
                      <View style={styles.macroProgressBar}>
                        <View style={[styles.macroProgressFill, { width: `${Math.min(macro.percentage, 100)}%`, backgroundColor: color }]} />
                      </View>
                      <Text style={styles.macroProgressText}>{macro.percentage.toFixed(0)}% of {macro.goal}{unit} goal</Text>
                    </View>
                  );
                })}
                <Text style={styles.macrosEntriesCount}>{todayStats.entries} {todayStats.entries === 1 ? "entry" : "entries"} logged</Text>
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No macros logged today</Text>
              </View>
            )}
            <TouchableOpacity style={styles.primaryButton} onPress={() => { setSelectedLogDate(null); macros.openMacrosModal(); }}>
              <Text style={styles.primaryButtonText}>+ Log Macros</Text>
            </TouchableOpacity>
          </View>
        );
      }

      case "bodyfat_height": {
        return (
          <View style={styles.heightCard}>
            {bodyFat.height?.height_cm ? (
              <View style={styles.heightDisplay}>
                <View style={styles.heightInfo}>
                  <Text style={styles.heightLabel}>Your Height</Text>
                  <Text style={styles.heightValue}>{bodyFat.heightUnit === "cm" ? `${bodyFat.height.height_cm.toFixed(1)} cm` : `${Math.floor(bodyFat.height.height_cm / 2.54 / 12)}' ${Math.round((bodyFat.height.height_cm / 2.54) % 12)}"`}</Text>
                  <Text style={styles.heightNote}>Required for body fat calculation</Text>
                </View>
                <TouchableOpacity style={styles.heightEditButton} onPress={() => { if (bodyFat.height?.height_cm) { if (bodyFat.heightUnit === "cm") bodyFat.setNewHeightCm(String(bodyFat.height.height_cm.toFixed(1))); else { const ti = bodyFat.height.height_cm / 2.54; bodyFat.setNewHeightFt(String(Math.floor(ti / 12))); bodyFat.setNewHeightIn(String(Math.round(ti % 12))); } } bodyFat.openHeightModal(); }}>
                  <Text style={styles.heightEditButtonText}>Edit</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.heightSetButton} onPress={() => bodyFat.openHeightModal()}>
                <Text style={styles.heightSetIcon}>📏</Text>
                <View style={styles.heightSetTextContainer}>
                  <Text style={styles.heightSetTitle}>Set Your Height</Text>
                  <Text style={styles.heightSetSubtitle}>Required to calculate body fat percentage</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        );
      }

      case "bodyfat_calendar":
        return <UniversalCalendar hasDataOnDate={bodyFat.hasDataOnDate} onDatePress={(date: Date) => handleCalendarDatePress(date, "bodyfat")} initialView="week" legendText="Measurement taken · tap any day to view/add" dotColor="#8b5cf6" />;

      case "bodyfat_latest": {
        return (
          <View>
            {bodyFat.history.length > 0 ? (
              <View style={styles.bodyFatCard}>
                <Text style={styles.bodyFatLabel}>Latest Measurement</Text>
                <Text style={styles.bodyFatValue}>{Number(bodyFat.history[0].percentage ?? (bodyFat.history[0] as any).body_fat_percentage ?? 0).toFixed(1)}%</Text>
                <Text style={styles.bodyFatDate}>{new Date(bodyFat.history[0].date ?? bodyFat.history[0].recorded_at ?? "").toLocaleDateString()}</Text>
                <Text style={styles.bodyFatMethod}>US Navy Method</Text>
                <TouchableOpacity style={styles.bodyFatDeleteBtn} onPress={() => bodyFat.deleteBodyFatEntry(bodyFat.history[0])}>
                  <Text style={styles.bodyFatDeleteBtnText}>🗑 Delete this reading</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.widgetLineMuted}>No body fat measurements yet.</Text>
            )}
            <TouchableOpacity style={styles.primaryButton} onPress={() => { setSelectedLogDate(null); bodyFat.openBodyFatModal(); }}>
              <Text style={styles.primaryButtonText}>📐 Calculate Body Fat</Text>
            </TouchableOpacity>
          </View>
        );
      }

      case "measurements_overview": {
        if (measurements.history.length === 0) {
          return (
            <View style={styles.trackerEmptyCard}>
              <Text style={styles.trackerEmptyIcon}>📏</Text>
              <Text style={styles.trackerEmptyText}>No measurements yet.</Text>
              <TouchableOpacity style={[styles.trackerHeroButton, { backgroundColor: "#10b981", marginTop: 0, paddingHorizontal: 16 }]} onPress={() => { setSelectedLogDate(null); measurements.openMeasurementModal(); }}>
                <Text style={styles.trackerHeroButtonText}>+ Log Measurements</Text>
              </TouchableOpacity>
            </View>
          );
        }
        const latest = measurements.history[0];
        return (
          <View style={styles.statsCard}>
            <Text style={styles.statsTitle}>Latest Measurements</Text>
            <Text style={styles.statsValue}>{`Waist: ${latest.waistCm ?? latest.waist ?? "—"} cm`}</Text>
            <Text style={styles.statsValue}>{`Left Arm: ${latest.armLeftCm ?? latest.arm_left ?? "—"} cm`}</Text>
            <Text style={styles.statsValue}>{`Right Arm: ${latest.armRightCm ?? latest.arm_right ?? "—"} cm`}</Text>
            <Text style={styles.statsValue}>{`Chest: ${latest.chestCm ?? latest.chest ?? "—"} cm`}</Text>
            <Text style={styles.statsDate}>{new Date(latest.measuredAt ?? latest.recorded_at ?? latest.date ?? "").toLocaleDateString()}</Text>
            <TouchableOpacity style={styles.primaryButton} onPress={() => { setSelectedLogDate(null); measurements.openMeasurementModal(); }}>
              <Text style={styles.primaryButtonText}>+ Log Measurements</Text>
            </TouchableOpacity>
          </View>
        );
      }

      case "measurements_calendar":
        return <UniversalCalendar hasDataOnDate={measurements.hasDataOnDate} onDatePress={(date: Date) => handleCalendarDatePress(date, "measurements")} initialView="week" legendText="Measurements logged · tap any day to view/add" dotColor="#10b981" />;

      case "measurements_history": {
        if (measurements.history.length === 0) {
          return (
            <View style={styles.trackerEmptyCard}>
              <Text style={styles.trackerEmptyIcon}>📏</Text>
              <Text style={styles.trackerEmptyText}>No measurement entries yet.</Text>
              <TouchableOpacity style={[styles.trackerHeroButton, { backgroundColor: "#10b981", marginTop: 0, paddingHorizontal: 16 }]} onPress={() => { setSelectedLogDate(null); measurements.openMeasurementModal(); }}>
                <Text style={styles.trackerHeroButtonText}>+ Log Measurements</Text>
              </TouchableOpacity>
            </View>
          );
        }
        return (
          <View>
            {measurements.history.map((entry: any, index: number) => (
              <View key={entry.id ?? index} style={[styles.weightEntryRow, index < measurements.history.length - 1 && styles.weightEntryRowBorder]}>
                <View>
                  <Text style={styles.weightEntryDate}>{new Date(entry.measuredAt ?? entry.recorded_at ?? entry.date ?? "").toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}</Text>
                  <Text style={styles.weightEntryTime}>{`Waist ${Number(entry.waistCm ?? entry.waist ?? 0).toFixed(1)} cm · Chest ${Number(entry.chestCm ?? entry.chest ?? 0).toFixed(1)} cm`}</Text>
                </View>
                <TouchableOpacity style={styles.deleteEntryBtn} onPress={() => measurements.deleteMeasurementEntry(entry)}>
                  <Text style={styles.deleteEntryBtnText}>🗑</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        );
      }
'''

with open(r'C:\Users\Superak0s\Documents\Coding\OwnLift\OwnLift-App\src\features\tracking\TrackingScreen.tsx', 'a', encoding='utf-8') as f:
    f.write(chunk1)
print('Chunk 1 appended OK')
