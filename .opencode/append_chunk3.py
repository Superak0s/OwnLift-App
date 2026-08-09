import sys

chunk3 = r'''
  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]} {...panHandlers}>
      {isPulling && (
        <View pointerEvents="none" style={styles.pullHint}>
          <Text style={styles.pullHintText}>{pullDistance > 90 ? "Release to add a widget ✨" : "Pull to add a widget ↓"}</Text>
        </View>
      )}
      <ScrollView style={styles.container} scrollEnabled={!isPulling} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.accent]} tintColor="#667eea" />}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>📊 Advanced Tracking</Text>
            <Text style={styles.subtitle}>Comprehensive body composition and nutrition tracking</Text>
          </View>

          <ScrollTabBar tabs={TRACKING_TABS} activeTab={activeTab} onTabChange={setActiveTab} storageKey="trackingScreen_tabConfig" />

          <View style={styles.widgetsSectionHeader}>
            <Text style={styles.widgetsSectionTitle}>{widgetEditMode ? "Editing Widgets" : " "}</Text>
            {widgetEditMode ? (
              <TouchableOpacity onPress={() => setWidgetEditMode(false)} hitSlop={8}>
                <Text style={styles.widgetsEditToggle}>Done</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.addWidgetButton} onPress={() => setShowWidgetGallery(true)}>
                <Text style={styles.addWidgetButtonText}>+ Widget</Text>
              </TouchableOpacity>
            )}
          </View>

          {activeBoard.isLoaded && activeBoard.widgets.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No widgets on this tab yet</Text>
              <TouchableOpacity style={styles.primaryButton} onPress={() => setShowWidgetGallery(true)}>
                <Text style={styles.primaryButtonText}>+ Add a Widget</Text>
              </TouchableOpacity>
            </View>
          )}

          <WidgetsPanel key={activeTab} widgets={activeBoard.widgets} isLoaded={activeBoard.isLoaded} editMode={widgetEditMode} onCycleSize={activeBoard.cycleWidgetSize} onRemove={activeBoard.removeWidget} onReorder={activeBoard.reorderWidgets} renderContent={renderWidgetContent} registry={activeRegistry as any} />
        </View>
      </ScrollView>

      <WidgetGallery visible={showWidgetGallery} onClose={() => setShowWidgetGallery(false)} availableWidgets={activeBoard.availableToAdd as any} onAddWidget={handleAddWidget} hasPlacedWidgets={activeBoard.widgets.length > 0} onEditWidgets={handleEditWidgets} />

      {/* Weight Modal */}
      <ModalSheet visible={weight.showWeightModal} onClose={() => { weight.closeWeightModal(); setSelectedLogDate(null); }} title="Log Weight" onConfirm={weight.addWeight}>
        <TextInput style={styles.input} placeholder={`Enter weight (${weight.weightUnit})`} keyboardType="decimal-pad" value={weight.newWeight} onChangeText={weight.setNewWeight} />
      </ModalSheet>

      {/* Height Modal */}
      <ModalSheet visible={bodyFat.showHeightModal} onClose={() => { bodyFat.closeHeightModal(); bodyFat.setNewHeightCm(""); bodyFat.setNewHeightFt(""); bodyFat.setNewHeightIn(""); }} title="Set Height" onConfirm={bodyFat.saveHeight} confirmText="Save" scrollable={false}>
        <Text style={styles.inputLabel}>Unit:</Text>
        <View style={styles.unitToggle}>
          {["cm", "ft"].map((u: string) => (
            <TouchableOpacity key={u} style={[styles.unitButton, bodyFat.heightUnit === u && styles.unitButtonActive]} onPress={() => { bodyFat.setHeightUnit(u); bodyFat.setNewHeightCm(""); bodyFat.setNewHeightFt(""); bodyFat.setNewHeightIn(""); }}>
              <Text style={[styles.unitButtonText, bodyFat.heightUnit === u && styles.unitButtonTextActive]}>{u}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {bodyFat.heightUnit === "cm" ? (
          <>
            <Text style={styles.inputLabel}>Height (cm)</Text>
            <TextInput style={styles.input} placeholder="e.g. 175" keyboardType="decimal-pad" value={bodyFat.newHeightCm} onChangeText={bodyFat.setNewHeightCm} />
          </>
        ) : (
          <>
            <Text style={styles.inputLabel}>Feet</Text>
            <TextInput style={styles.input} placeholder="e.g. 5" keyboardType="decimal-pad" value={bodyFat.newHeightFt} onChangeText={bodyFat.setNewHeightFt} />
            <Text style={styles.inputLabel}>Inches</Text>
            <TextInput style={styles.input} placeholder="e.g. 10" keyboardType="decimal-pad" value={bodyFat.newHeightIn} onChangeText={bodyFat.setNewHeightIn} />
          </>
        )}
      </ModalSheet>

      <LogCycleModal visible={modalState.cycleModalOpen} onClose={closeCycleModal} prefillDate={selectedLogDate ?? undefined} onSuccess={() => loadTabData()} />

      <LogHydrationModal visible={modalState.hydrationModalOpen} onClose={() => { closeHydrationModal(); setSelectedLogDate(null); }} onSuccess={() => loadTabData()} />

      <LogSorenessModal visible={modalState.sorenessModalOpen} onClose={() => { closeSorenessModal(); setSelectedLogDate(null); }} onSuccess={() => loadTabData()} />

      {/* Macros Modal */}
      <ModalSheet visible={macros.showMacrosModal} onClose={() => { macros.closeMacrosModal(); setSelectedLogDate(null); }} title="Log Macros" onConfirm={macros.addMacrosEntry} scrollable={true}>
        <Text style={styles.inputLabel}>Name <Text style={styles.inputLabelOptional}>(e.g. "Chicken & rice")</Text></Text>
        <TextInput style={styles.input} placeholder="What did you eat? (optional)" value={macros.newName} onChangeText={macros.setNewName} autoCapitalize="words" />
        <View style={styles.optionalDivider}>
          <View style={styles.optionalDividerLine} />
          <Text style={styles.optionalDividerText}>Fill in what you know — all fields below are optional</Text>
          <View style={styles.optionalDividerLine} />
        </View>
        <Text style={styles.inputLabel}>Calories (kcal)</Text>
        <TextInput style={styles.input} placeholder="e.g. 420" keyboardType="decimal-pad" value={macros.newCalories} onChangeText={macros.setNewCalories} />
        <Text style={styles.inputLabel}>Protein (g)</Text>
        <TextInput style={styles.input} placeholder="e.g. 32" keyboardType="decimal-pad" value={macros.newProtein} onChangeText={macros.setNewProtein} />
        <Text style={styles.inputLabel}>Carbohydrates (g)</Text>
        <TextInput style={styles.input} placeholder="e.g. 45" keyboardType="decimal-pad" value={macros.newCarbs} onChangeText={macros.setNewCarbs} />
        <Text style={styles.inputLabel}>Fat (g)</Text>
        <TextInput style={styles.input} placeholder="e.g. 12" keyboardType="decimal-pad" value={macros.newFat} onChangeText={macros.setNewFat} />
        <Text style={styles.inputLabel}>Time</Text>
        <TextInput style={styles.input} placeholder="HH:MM" value={macros.newTime} onChangeText={macros.setNewTime} />
        <Text style={styles.inputLabel}>Measurement Error (±%)</Text>
        <TextInput style={styles.input} placeholder="e.g. 5  →  ±5%" keyboardType="decimal-pad" value={macros.newError} onChangeText={macros.setNewError} />
        <Text style={styles.modalHint}>Error margin is used to calculate a min/max range for your totals</Text>
      </ModalSheet>

      {/* Macros Goals Modal */}
      <ModalSheet visible={macros.showMacrosGoalModal} onClose={() => macros.closeGoalModal()} title="Set Daily Macros Goals" onConfirm={macros.updateMacrosGoals} scrollable={true}>
        <Text style={styles.inputLabel}>Protein goal (g)</Text>
        <TextInput style={styles.input} placeholder="e.g., 150" keyboardType="decimal-pad" value={macros.goalsInput.protein} onChangeText={(v) => macros.setGoalsInput(p => ({ ...p, protein: v }))} />
        <Text style={styles.inputLabel}>Carbohydrates goal (g)</Text>
        <TextInput style={styles.input} placeholder="e.g., 250" keyboardType="decimal-pad" value={macros.goalsInput.carbs} onChangeText={(v) => macros.setGoalsInput(p => ({ ...p, carbs: v }))} />
        <Text style={styles.inputLabel}>Fat goal (g)</Text>
        <TextInput style={styles.input} placeholder="e.g., 65" keyboardType="decimal-pad" value={macros.goalsInput.fat} onChangeText={(v) => macros.setGoalsInput(p => ({ ...p, fat: v }))} />
        <Text style={styles.inputLabel}>Calories goal (kcal)</Text>
        <TextInput style={styles.input} placeholder="e.g., 2000" keyboardType="decimal-pad" value={macros.goalsInput.calories} onChangeText={(v) => macros.setGoalsInput(p => ({ ...p, calories: v }))} />
      </ModalSheet>

      {/* Body Fat Modal */}
      <ModalSheet visible={bodyFat.showBodyFatModal} onClose={() => { bodyFat.closeBodyFatModal(); setSelectedLogDate(null); }} title="Calculate Body Fat %" subtitle="US Navy Method" onConfirm={bodyFat.calculateBodyFat} confirmText="Calculate" scrollable={true}>
        <View style={styles.genderToggle}>
          {["male", "female"].map((g: string) => (
            <TouchableOpacity key={g} style={[styles.genderButton, bodyFat.gender === g && styles.genderButtonActive]} onPress={() => { bodyFat.setGender(g); AsyncStorage.setItem(getUserKey("gender"), g); }}>
              <Text style={[styles.genderButtonText, bodyFat.gender === g && styles.genderButtonTextActive]}>{g.charAt(0).toUpperCase() + g.slice(1)}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.unitToggleContainer}>
          <Text style={styles.inputLabel}>Unit:</Text>
          <View style={styles.unitToggle}>
            {["cm", "in"].map((u: string) => (
              <TouchableOpacity key={u} style={[styles.unitButton, bodyFat.measurementUnit === u && styles.unitButtonActive]} onPress={() => bodyFat.setMeasurementUnit(u)}>
                <Text style={styles.unitButtonText}>{u}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <Text style={styles.inputLabel}>Waist ({bodyFat.measurementUnit})</Text>
        <TextInput style={styles.input} placeholder="Measure at navel" keyboardType="decimal-pad" value={bodyFat.waist} onChangeText={bodyFat.setWaist} />
        <Text style={styles.inputLabel}>Neck ({bodyFat.measurementUnit})</Text>
        <TextInput style={styles.input} placeholder="Measure below larynx" keyboardType="decimal-pad" value={bodyFat.neck} onChangeText={bodyFat.setNeck} />
        {bodyFat.gender === "female" && (
          <>
            <Text style={styles.inputLabel}>Hip ({bodyFat.measurementUnit})</Text>
            <TextInput style={styles.input} placeholder="Measure at widest point" keyboardType="decimal-pad" value={bodyFat.hip} onChangeText={bodyFat.setHip} />
          </>
        )}
      </ModalSheet>

      {/* Measurement Modal */}
      <ModalSheet visible={measurements.showMeasurementModal} onClose={() => { measurements.closeMeasurementModal(); setSelectedLogDate(null); }} title="Log Measurements" onConfirm={measurements.handleLogMeasurement}>
        <Text style={styles.inputLabel}>Waist (cm)</Text>
        <TextInput style={styles.input} placeholder="e.g., 80" keyboardType="decimal-pad" value={measurements.newWaist} onChangeText={measurements.setNewWaist} />
        <Text style={styles.inputLabel}>Left Arm (cm)</Text>
        <TextInput style={styles.input} placeholder="e.g., 30" keyboardType="decimal-pad" value={measurements.newArmLeft} onChangeText={measurements.setNewArmLeft} />
        <Text style={styles.inputLabel}>Right Arm (cm)</Text>
        <TextInput style={styles.input} placeholder="e.g., 30" keyboardType="decimal-pad" value={measurements.newArmRight} onChangeText={measurements.setNewArmRight} />
        <Text style={styles.inputLabel}>Chest (cm)</Text>
        <TextInput style={styles.input} placeholder="e.g., 100" keyboardType="decimal-pad" value={measurements.newChest} onChangeText={measurements.setNewChest} />
        <View style={styles.optionalDivider}>
          <View style={styles.optionalDividerLine} />
          <Text style={styles.optionalDividerText}>Custom Body Part</Text>
          <View style={styles.optionalDividerLine} />
        </View>
        <Text style={styles.inputLabel}>Body Part Name</Text>
        <TextInput style={styles.input} placeholder="e.g., Calves" value={measurements.newCustomBodyPart} onChangeText={measurements.setNewCustomBodyPart} autoCapitalize="words" />
        <Text style={styles.inputLabel}>Value (cm)</Text>
        <TextInput style={styles.input} placeholder="e.g., 38" keyboardType="decimal-pad" value={measurements.newCustomBodyPartValue} onChangeText={measurements.setNewCustomBodyPartValue} />
      </ModalSheet>

      {/* Per-day Flow Modal (menstrual) */}
      <ModalSheet visible={showFlowModal} onClose={() => { setShowFlowModal(false); setFlowModalDate(null); setFlowModalCycleEntry(null); }} title="Set Flow Intensity" onConfirm={async () => {
        if (!flowModalDate) return;
        try {
          await menstrualApi.setDayFlow(flowModalDate, flowModalIntensity);
          setShowFlowModal(false); setFlowModalDate(null); setFlowModalCycleEntry(null);
          await loadFromServer();
          alert("Saved", "Flow intensity saved", [{ text: "OK" }], "success");
        } catch (err) { alert("Error", err instanceof Error ? err.message : String(err), [{ text: "OK" }], "error"); }
      }}>
        <Text style={styles.inputLabel}>Date</Text>
        <Text style={{ marginBottom: 12 }}>{flowModalDate}</Text>
        <Text style={styles.inputLabel}>Intensity</Text>
        <View style={{ flexDirection: "row", marginTop: 8 }}>
          {(["light", "moderate", "heavy"] as const).map((opt) => (
            <TouchableOpacity key={opt} style={[styles.optionButton, flowModalIntensity === opt && styles.optionButtonActive, { marginRight: 8 }]} onPress={() => setFlowModalIntensity(opt)}>
              <Text style={flowModalIntensity === opt ? styles.optionButtonTextActive : styles.optionButtonText}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {flowModalCycleEntry && (
          <TouchableOpacity style={styles.dangerButton} onPress={() => {
            alert("Delete Period?", "This removes the entire logged period that started on this date, not just this day.", [
              { text: "Cancel", style: "cancel" },
              { text: "Delete", style: "destructive", onPress: async () => {
                try {
                  await menstrualApi.deleteMenstrualEntry(flowModalCycleEntry.id);
                  setShowFlowModal(false); setFlowModalDate(null); setFlowModalCycleEntry(null);
                  await loadFromServer();
                  alert("Deleted", "Period deleted", [{ text: "OK" }], "success");
                } catch (err) { alert("Error", err instanceof Error ? err.message : String(err), [{ text: "OK" }], "error"); }
              }},
            ], "warning");
          }}>
            <Text style={styles.dangerButtonText}>🗑 Delete This Period</Text>
          </TouchableOpacity>
        )}
      </ModalSheet>

      {/* UNIFIED DAY MODAL */}
      <ModalSheet visible={!!dayModal} onClose={() => { setDayModal(null); setSelectedLogDate(null); }} showCancelButton={false} showConfirmButton={false} scrollable={true}>
        <View style={styles.dayModalHeader}>
          <View style={styles.dayModalIconCircle}>
            <Text style={styles.dayModalIcon}>
              {dayModal?.tab === "weight" ? "⚖️" : dayModal?.tab === "macros" ? "🥗" : dayModal?.tab === "photos" ? "📸" : dayModal?.tab === "bodyfat" ? "📐" : dayModal?.tab === "measurements" ? "📏" : dayModal?.tab === "hydration" ? "💧" : dayModal?.tab === "soreness" ? "💪" : dayModal?.tab === "menstrual" ? "🌸" : "📐"}
            </Text>
          </View>
          <View style={styles.dayModalHeaderText}>
            <Text style={styles.dayModalTitle}>
              {dayModal?.tab === "weight" ? "Weight" : dayModal?.tab === "macros" ? "Macros" : dayModal?.tab === "photos" ? "Photos" : dayModal?.tab === "bodyfat" ? "Body Fat" : dayModal?.tab === "measurements" ? "Measurements" : dayModal?.tab === "hydration" ? "Hydration" : dayModal?.tab === "soreness" ? "Soreness" : dayModal?.tab === "menstrual" ? "Cycle" : "Entry"}
            </Text>
            <Text style={styles.dayModalSubtitle}>{dayModal?.isToday ? "Today" : dayModal?.date?.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</Text>
          </View>
        </View>
        <View style={styles.dayModalDivider} />
        {renderDayModalExistingEntries()}
        {(!dayModal?.existingEntries || dayModal.existingEntries.length === 0) && (
          <View style={styles.dayModalEmptyState}>
            <Text style={styles.dayModalEmptyIcon}>
              {dayModal?.tab === "weight" ? "⚖️" : dayModal?.tab === "macros" ? "🥗" : dayModal?.tab === "photos" ? "📸" : dayModal?.tab === "bodyfat" ? "📐" : dayModal?.tab === "measurements" ? "📏" : dayModal?.tab === "hydration" ? "💧" : dayModal?.tab === "soreness" ? "💪" : dayModal?.tab === "menstrual" ? "🌸" : "📐"}
            </Text>
            <Text style={styles.dayModalEmptyText}>No entries for this day</Text>
          </View>
        )}
        <TouchableOpacity style={styles.logEntryBtn} onPress={() => openLogModalForTab(dayModal?.tab ?? activeTab)}>
          <Text style={styles.logEntryBtnText}>
            {dayModal?.tab === "weight" ? "⚖️ Log Weight" : dayModal?.tab === "macros" ? "🥗 Log Macros" : dayModal?.tab === "photos" ? "📸 Add Photo" : dayModal?.tab === "bodyfat" ? "📐 Calculate Body Fat" : dayModal?.tab === "measurements" ? "📏 Log Measurements" : dayModal?.tab === "hydration" ? "💧 Log Water" : dayModal?.tab === "soreness" ? "💪 Log Soreness" : dayModal?.tab === "menstrual" ? "🌸 Log Cycle" : "Add Entry"}
          </Text>
        </TouchableOpacity>
      </ModalSheet>
    </SafeAreaView>
  );
}
'''

with open(r'C:\Users\Superak0s\Documents\Coding\OwnLift\OwnLift-App\src\features\tracking\TrackingScreen.tsx', 'a', encoding='utf-8') as f:
    f.write(chunk3)
print('Chunk 3 appended OK')
