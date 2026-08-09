import sys

chunk2 = r'''
      case "hydration_overview": {
        const todayStr = toLocalDateStr(new Date());
        const totalToday = hydration.entries.filter(h => isoToLocalDateStr(h?.loggedAt ?? h?.recorded_at) === todayStr).reduce((s, e) => s + (Number(e.amountMl ?? e.amount_ml ?? e.amount) || 0), 0);
        const pct = hydration.goal ? Math.min(100, Math.round((totalToday / hydration.goal) * 100)) : 0;
        return (
          <View style={[styles.trackerHeroCard, { backgroundColor: "#e0f2fe", borderColor: "#7dd3fc" }]}>
            <View style={styles.trackerHeroTop}>
              <View style={[styles.trackerHeroBadge, { backgroundColor: "#fff" }]}>
                <Text style={styles.trackerHeroBadgeIcon}>💧</Text>
              </View>
              <Text style={[styles.trackerHeroLabel, { color: "#0369a1" }]}>{pct}% of goal</Text>
            </View>
            <Text style={[styles.trackerHeroValue, { color: "#0c4a6e" }]}>{`${totalToday} / ${hydration.goal} ml`}</Text>
            <Text style={styles.trackerHeroDate}>{new Date().toLocaleDateString()}</Text>
            <TouchableOpacity style={[styles.trackerHeroButton, { backgroundColor: "#0369a1" }]} onPress={() => { setSelectedLogDate(null); hydration.openHydrationModal(); }}>
              <Text style={styles.trackerHeroButtonText}>+ Log Water</Text>
            </TouchableOpacity>
          </View>
        );
      }

      case "hydration_calendar":
        return <UniversalCalendar hasDataOnDate={hydration.hasDataOnDate} onDatePress={(date: Date) => handleCalendarDatePress(date, "hydration")} initialView="week" legendText="Hydration logged · tap any day to view/add" dotColor="#667eea" />;

      case "hydration_history": {
        if (hydration.entries.length === 0)
          return (
            <View style={styles.trackerEmptyCard}>
              <Text style={styles.trackerEmptyIcon}>💧</Text>
              <Text style={styles.trackerEmptyText}>No hydration entries yet.</Text>
              <TouchableOpacity style={[styles.trackerHeroButton, { backgroundColor: "#0369a1", marginTop: 0, paddingHorizontal: 16 }]} onPress={() => { setSelectedLogDate(null); hydration.openHydrationModal(); }}>
                <Text style={styles.trackerHeroButtonText}>+ Log Water</Text>
              </TouchableOpacity>
            </View>
          );
        return (
          <View style={styles.trackerHistoryList}>
            {hydration.entries.map((h: any, i: number) => (
              <View key={h.id ?? i} style={[styles.trackerHistoryRow, i < hydration.entries.length - 1 && styles.trackerHistoryRowBorder]}>
                <View style={styles.trackerHistoryLeft}>
                  <View style={[styles.trackerHistoryDot, { backgroundColor: "#0ea5e9" }]} />
                  <View>
                    <Text style={styles.trackerHistoryDate}>{formatDateLabel(h.loggedAt ?? h.recorded_at ?? h.date ?? null)}</Text>
                    <Text style={styles.trackerHistoryTime}>{`${Number(h.amountMl ?? h.amount_ml ?? h.amount).toFixed(0)} ml`}</Text>
                  </View>
                </View>
                <View style={styles.trackerHistoryRight}>
                  <Text style={styles.trackerHistoryValue}>{`${Number(h.amountMl ?? h.amount_ml ?? h.amount).toFixed(0)} ml`}</Text>
                  <TouchableOpacity style={styles.trackerDeleteBtn} onPress={() => hydration.deleteHydrationEntry(h)}>
                    <Text style={styles.trackerDeleteBtnText}>🗑</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        );
      }

      case "hydration_goal":
        return <HydrationSettingsWidget onSettingsUpdate={({ goalMl }: { goalMl: number }) => hydration.setGoal(goalMl)} />;

      case "soreness_map": {
        if (soreness.entries.length === 0)
          return (
            <View style={styles.trackerEmptyCard}>
              <Text style={styles.trackerEmptyIcon}>🔥</Text>
              <Text style={styles.trackerEmptyText}>No soreness logged yet.</Text>
              <TouchableOpacity style={[styles.trackerHeroButton, { backgroundColor: "#ea580c", marginTop: 0, paddingHorizontal: 16 }]} onPress={() => { setSelectedLogDate(null); soreness.openSorenessModal(); }}>
                <Text style={styles.trackerHeroButtonText}>+ Log Soreness</Text>
              </TouchableOpacity>
            </View>
          );
        const last = soreness.entries[0];
        const lastIntensity = Number(last.intensity ?? last.value ?? 0);
        const intensityColor = lastIntensity <= 3 ? "#22c55e" : lastIntensity <= 6 ? "#f59e0b" : "#ef4444";
        return (
          <View style={[styles.trackerHeroCard, { backgroundColor: "#fff7ed", borderColor: "#fed7aa" }]}>
            <View style={styles.trackerHeroTop}>
              <View style={[styles.trackerHeroBadge, { backgroundColor: "#fff" }]}>
                <Text style={styles.trackerHeroBadgeIcon}>🔥</Text>
              </View>
              <Text style={[styles.trackerHeroLabel, { color: intensityColor }]}>{lastIntensity}/10</Text>
            </View>
            <Text style={[styles.trackerHeroValue, { color: "#9a3412" }]}>{last.muscleGroup ?? last.muscle ?? last.muscle_group ?? "—"}</Text>
            <Text style={styles.trackerHeroDate}>{new Date(last.loggedAt ?? last.recorded_at ?? last.date ?? "").toLocaleDateString()}</Text>
            <TouchableOpacity style={[styles.trackerHeroButton, { backgroundColor: "#ea580c" }]} onPress={() => { setSelectedLogDate(null); soreness.openSorenessModal(); }}>
              <Text style={styles.trackerHeroButtonText}>+ Log Soreness</Text>
            </TouchableOpacity>
          </View>
        );
      }

      case "soreness_calendar":
        return <UniversalCalendar hasDataOnDate={soreness.hasDataOnDate} onDatePress={(date: Date) => handleCalendarDatePress(date, "soreness")} initialView="week" legendText="Soreness logged · tap any day to view/add" dotColor="#f97316" />;

      case "soreness_history": {
        if (soreness.entries.length === 0)
          return (
            <View style={styles.trackerEmptyCard}>
              <Text style={styles.trackerEmptyIcon}>🔥</Text>
              <Text style={styles.trackerEmptyText}>No soreness entries yet.</Text>
            </View>
          );
        return (
          <View style={styles.trackerHistoryList}>
            {soreness.entries.map((s: any, i: number) => {
              const val = Number(s.intensity ?? s.value ?? 0);
              const dotColor = val <= 3 ? "#22c55e" : val <= 6 ? "#f59e0b" : "#ef4444";
              return (
                <View key={s.id ?? i} style={[styles.trackerHistoryRow, i < soreness.entries.length - 1 && styles.trackerHistoryRowBorder]}>
                  <View style={styles.trackerHistoryLeft}>
                    <View style={[styles.trackerHistoryDot, { backgroundColor: dotColor }]} />
                    <View>
                      <Text style={styles.trackerHistoryDate}>{new Date(s.loggedAt ?? s.recorded_at ?? s.date ?? "").toLocaleDateString()}</Text>
                      <Text style={styles.trackerHistoryTime}>{`${s.muscleGroup ?? s.muscle ?? s.muscle_group ?? "—"} · ${val}/10`}</Text>
                    </View>
                  </View>
                  <TouchableOpacity style={styles.trackerDeleteBtn} onPress={() => soreness.deleteSorenessEntry(s)}>
                    <Text style={styles.trackerDeleteBtnText}>🗑</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        );
      }

      case "menstrual_overview": {
        if (menstrual.entries.length === 0) return <Text style={styles.widgetLineMuted}>No cycle data yet.</Text>;
        const last = menstrual.entries[0];
        const lastPhase = getCyclePhaseLabel(getCycleStartIso(last), menstrual.prefs.periodLengthDays, menstrual.prefs.cycleLengthDays) ?? "—";
        return (
          <View style={styles.statsCard}>
            <Text style={styles.statsTitle}>Cycle Status</Text>
            <Text style={styles.statsValue}>{`Phase: ${lastPhase}`}</Text>
            <Text style={styles.statsDate}>{`Started: ${formatDateLabel(getCycleStartIso(last))}`}</Text>
            <TouchableOpacity style={styles.primaryButton} onPress={() => { setSelectedLogDate(null); menstrual.openCycleModal(); }}>
              <Text style={styles.primaryButtonText}>+ Log Cycle</Text>
            </TouchableOpacity>
          </View>
        );
      }

      case "menstrual_calendar":
        return (
          <UniversalCalendar
            hasDataOnDate={menstrual.hasDataOnDate}
            onDatePress={(date: Date) => handleCalendarDatePress(date, "menstrual")}
            initialView="month"
            legendText="Cycle start · tap any day to view/add"
            dotColor="#ec4899"
            getDayDecoration={(date: Date) => {
              const ds = toLocalDateStr(date);
              if (menstrual.actualDays.has(ds)) return { backgroundColor: "rgba(224,79,95,0.12)", dotColor: "#e04f5f" };
              if (menstrual.predictedDays.has(ds)) return { backgroundColor: "rgba(239,68,68,0.20)", dotColor: "#ef4444" };
              return null;
            }}
          />
        );

      case "menstrual_cycle":
        return (
          <View>
            <CycleSettingsWidget onSettingsUpdate={async ({ periodDays, cycleLengthDays }) => {
              const updatedPrefs = { periodLengthDays: periodDays, cycleLengthDays };
              menstrual.setPrefs(updatedPrefs);
              try {
                const mostRecentStartIso = menstrual.entries.length > 0 ? getCycleStartIso(menstrual.entries[0]) : null;
                const nextSet = computeUpcomingPredictedDays(mostRecentStartIso, cycleLengthDays, periodDays);
                menstrual.setPredictedDays(nextSet);
              } catch (e) { console.warn("Failed to refresh cycle predictions:", e); }
            }} />
            <TouchableOpacity style={[styles.primaryButton, { marginTop: 12 }]} onPress={() => { setSelectedLogDate(new Date()); menstrual.openCycleModal(); }}>
              <Text style={styles.primaryButtonText}>+ Log Cycle Today</Text>
            </TouchableOpacity>
          </View>
        );

      case "menstrual_history": {
        if (menstrual.entries.length === 0) return <Text style={styles.widgetLineMuted}>No cycle history yet.</Text>;
        return (
          <View>
            {menstrual.entries.map((c: any, i: number) => {
              const entryId = c.id ?? i;
              const entryKey = String(entryId);
              const isExpanded = expandedCycleIds.has(entryKey);
              const startDateLabel = formatDateLabel(getCycleStartIso(c));
              return (
                <View key={entryKey} style={styles.cycleHistoryRow}>
                  <TouchableOpacity style={[styles.weightEntryRow, i < menstrual.entries.length - 1 && styles.weightEntryRowBorder]} onPress={() => toggleExpandedCycle(entryKey)}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.weightEntryDate}>{startDateLabel}</Text>
                      <Text style={styles.weightEntryTime}>{`Duration: ${getCycleDuration(c)} days · Flow: ${getCycleFlowLabel(c)}`}</Text>
                    </View>
                    <Text style={styles.cycleToggleText}>{isExpanded ? "Hide details" : "Show details"}</Text>
                  </TouchableOpacity>
                  {isExpanded && (
                    <View style={styles.cycleDetailsBox}>
                      {i === 0 && (() => {
                        const phase = getCyclePhaseLabel(getCycleStartIso(c), menstrual.prefs.periodLengthDays, menstrual.prefs.cycleLengthDays);
                        return phase ? <Text style={styles.cycleDetailsLine}>Phase: {phase}</Text> : null;
                      })()}
                      <Text style={styles.cycleDetailsLine}>Cycle start: {startDateLabel}</Text>
                      <Text style={styles.cycleDetailsLine}>Period length: {getCycleDuration(c)} days</Text>
                      {(c.notes || c.note) && <Text style={styles.cycleDetailsNote}>Note: {Array.isArray(c.notes) ? c.notes[0] : (c.notes ?? c.note)}</Text>}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        );
      }

      case "doms_followup": return <DOMSFollowUpWidget />;
      case "doms_heatmap": return <DOMSHeatmapWidget />;
      case "injury_tracker": return <InjuryTrackerWidget />;

      case "measurements_chart": {
        if (measurements.customEntries.length === 0) {
          return (
            <View style={styles.trackerEmptyCard}>
              <Text style={styles.trackerEmptyIcon}>📈</Text>
              <Text style={styles.trackerEmptyText}>No measurements to chart yet.</Text>
            </View>
          );
        }
        const raw = measurements.customEntries.slice(0, 30).reverse().map((m: any) => {
          const date = new Date(m.loggedAt ?? m.recorded_at ?? m.date ?? new Date());
          return { label: date.toISOString().split("T")[0], value: parseFloat(String(m.waist ?? m.value ?? m.measurement ?? 0)) || 0 };
        });
        return <ProgressChart title="Measurements" icon="📏" data={{ labels: raw.map(r => r.label), datasets: [{ data: raw.map(r => r.value) }] }} yAxisSuffix="cm" />;
      }

      case "photos_comparison": return <PhotosComparisonWidget />;
      case "photos_muscle_notes": return <PhotosMuscleNotesWidget />;
      case "photos_muscle_view": return <PhotosMuscleViewWidget />;

      default: return <Text style={styles.widgetLineMuted}>Coming soon</Text>;
    }
  };
'''

with open(r'C:\Users\Superak0s\Documents\Coding\OwnLift\OwnLift-App\src\features\tracking\TrackingScreen.tsx', 'a', encoding='utf-8') as f:
    f.write(chunk2)
print('Chunk 2 appended OK')
