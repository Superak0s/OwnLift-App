import React, { useState, useEffect, useRef } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StatusBar } from "expo-status-bar";
import {
  View,
  StyleSheet,
  Platform,
  Text,
  TouchableOpacity,
  Animated,
  PanResponder,
  ScrollView,
  AppState,
  type AppStateStatus,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "./src/shared/context/AuthContext";
import { WorkoutProvider } from "./src/shared/context/WorkoutContext";
import * as NavigationBar from "expo-navigation-bar";
import { getStorageItem } from "./src/shared/services/sqliteStorage";
import { useAlert } from "./src/shared/components/CustomAlert";
import { useTabBar, TabBarProvider } from "./src/shared/context/TabBarContext";
import { VersionGuard } from "./src/shared/components/VersionGuard";
import { ThemeProvider, useTheme } from "./src/shared/context/ThemeContext";
import { TrackingModalsProvider } from "./src/features/tracking/context/TrackingModalsContext";

import LoginScreen from "./src/features/auth/LoginScreen";
import SignupScreen from "./src/features/auth/SignupScreen";
import HomeScreen from "./src/features/homescreen/HomeScreen";
import WorkoutScreen from "./src/features/workout/WorkoutScreen";
import AnalyticsScreen from "./src/features/analytics/AnalyticsScreen";
import TrackingScreen from "./src/features/tracking/TrackingScreen";
import SupplementsScreen from "./src/features/supplements/SupplementsScreen";
import FriendsScreen from "./src/features/friends/FriendsScreen";
import SettingsScreen from "./src/features/settings/SettingsScreen";
import PlanScreen from "./src/features/plan/PlanScreen";

import {
  registerLocationTask,
  unregisterLocationTask,
  isLocationTaskRegistered,
  initializeSupplementNotifications,
  scheduleTimeReminder,
} from "./tasks/supplementLocationTask";
import { getNotifications } from "./src/shared/services/notifications";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TabIconProps {
  icon: string;
  label: string;
  focused: boolean;
}

interface CustomTabBarProps {
  state: {
    index: number;
    routes: Array<{ key: string; name: string }>;
  };
  descriptors: Record<
    string,
    {
      options: {
        tabBarIcon?: (opts: { focused: boolean }) => React.ReactNode;
      };
    }
  >;
  navigation: {
    emit: (opts: {
      type: string;
      target: string;
      canPreventDefault: boolean;
    }) => { defaultPrevented: boolean };
    navigate: (name: string) => void;
  };
}

// ─── Navigation setup ─────────────────────────────────────────────────────────

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// ─── Notification handler ─────────────────────────────────────────────────────
// No-op in Expo Go — the Notifications module is never loaded there.
void (async () => {
  try {
    const Notifications = await getNotifications();
    if (Notifications?.setNotificationHandler) {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
    }
  } catch (error) {
    console.log(
      "Notifications not available in Expo Go:",
      (error as Error).message,
    );
  }
})();

// ─── Android nav bar helper ───────────────────────────────────────────────────

const hideNavBar = async () => {
  if (Platform.OS === "android") {
    try {
      // @ts-ignore deprecated API, no replacement
      await NavigationBar.setVisibilityAsync("hidden");
    } catch (error) {
      console.log("Failed to hide navigation bar:", (error as Error).message);
    }
  }
};

const showNavBarTemporarily = async (ms = 3000) => {
  if (Platform.OS !== "android") return;
  try {
    // @ts-ignore deprecated API, no replacement
    await NavigationBar.setVisibilityAsync("visible");
    setTimeout(() => void hideNavBar(), ms);
  } catch (error) {
    console.log("Failed to show navigation bar:", (error as Error).message);
  }
};

// ─── Tab Icon ─────────────────────────────────────────────────────────────────

const TabIcon = ({ icon, label, focused }: TabIconProps) => {
  const { colors } = useTheme();
  return (
    <View style={styles.tabIconContainer}>
      <View
        style={[
          styles.iconWrapper,
          focused && {
            backgroundColor: colors.accent,
            shadowColor: colors.accent,
            borderRadius: 23,
          },
        ]}
      >
        <Text style={styles.icon}>{icon}</Text>
      </View>
      <Text
        style={[
          styles.label,
          focused && { color: colors.accent, fontWeight: "700" },
        ]}
      >
        {label}
      </Text>
    </View>
  );
};

// ─── Custom Tab Bar ───────────────────────────────────────────────────────────

const CustomTabBar = ({
  state,
  descriptors,
  navigation,
}: CustomTabBarProps) => {
  const { colors } = useTheme();
  const scrollViewRef = useRef<ScrollView>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const { setIsTabBarCollapsed } = useTabBar();

  useEffect(() => {
    const activeIndex = state.index;
    if (scrollViewRef.current) {
      if (activeIndex >= 3) {
        scrollViewRef.current.scrollTo({
          x: (activeIndex - 2) * 80,
          animated: true,
        });
      } else {
        scrollViewRef.current.scrollTo({ x: 0, animated: true });
      }
    }
  }, [state.index]);

  const handleToggle = () => {
    const toValue = isCollapsed ? 0 : 1;
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }),
      Animated.spring(rotateAnim, {
        toValue,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }),
    ]).start();
    const next = !isCollapsed;
    setIsCollapsed(next);
    setIsTabBarCollapsed(next);
  };

  const tabBarTranslateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -400],
  });
  const arrowTranslateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -330],
  });
  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });

  return (
    <View pointerEvents='box-none'>
      <Animated.View
        style={[
          styles.customTabBarContainer,
          {
            shadowColor: colors.accent,
            transform: [{ translateX: tabBarTranslateX }],
          },
        ]}
      >
        <View
          style={[styles.tabBarBackground, { backgroundColor: colors.surface }]}
        >
          <LinearGradient
            colors={[colors.surface, colors.surfaceElevated]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradient}
          />
        </View>

        <ScrollView
          ref={scrollViewRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          style={styles.scrollView}
        >
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const isFocused = state.index === index;

            const onPress = () => {
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });
              if (!isFocused && !event.defaultPrevented)
                navigation.navigate(route.name);
            };

            const IconComponent = options.tabBarIcon;
            return (
              <TouchableOpacity
                key={route.key}
                onPress={onPress}
                style={styles.tabButton}
                activeOpacity={0.7}
              >
                {IconComponent?.({ focused: isFocused })}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </Animated.View>

      <Animated.View
        style={[
          styles.toggleContainer,
          { transform: [{ translateX: arrowTranslateX }] },
        ]}
      >
        <TouchableOpacity
          style={styles.toggleButton}
          onPress={handleToggle}
          activeOpacity={0.7}
        >
          <LinearGradient
            colors={[colors.accent, colors.accentDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.toggleGradient}
          >
            <Animated.Text
              style={[
                styles.toggleArrow,
                { transform: [{ rotate: rotation }] },
              ]}
            >
              ◀
            </Animated.Text>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

// ─── Tab bar render helpers ───────────────────────────────────────────────────
// Defined once at module scope instead of inline in JSX, so React Navigation
// isn't handed a brand-new component definition on every MainTabs render.

const renderCustomTabBar = (props: Record<string, unknown>) => (
  <CustomTabBar {...(props as unknown as CustomTabBarProps)} />
);

const createTabBarIcon =
  (icon: string, label: string) =>
  ({ focused }: { focused: boolean }) => (
    <TabIcon icon={icon} label={label} focused={focused} />
  );

const HomeTabBarIcon = createTabBarIcon("🏠", "Home");
const WorkoutTabBarIcon = createTabBarIcon("💪", "Workout");
const PlanTabBarIcon = createTabBarIcon("📋", "Plan");
const AnalyticsTabBarIcon = createTabBarIcon("📊", "Progress");
const TrackingTabBarIcon = createTabBarIcon("📈", "Track");
const SupplementsTabBarIcon = createTabBarIcon("💊", "Supps");
const FriendsTabBarIcon = createTabBarIcon("👥", "Friends");
const SettingsTabBarIcon = createTabBarIcon("⚙️", "Settings");

// ─── Notification Listener ────────────────────────────────────────────────────

interface SupplementReminderConfig {
  supplementId: number;
  name: string;
  unit: string;
  defaultAmount: number;
  reminderTime: string;
  timeBasedEnabled: boolean;
}

async function handleSupplementTimeReminderNotification(
  data: Record<string, unknown>,
  userId: string,
) {
  const supplementId = data.supplementId as number | undefined;
  if (!supplementId) return;

  const configsKey = `supplementReminderConfigs_user_${userId}`;
  const raw = await getStorageItem(configsKey);
  if (!raw) return;

  const configs = JSON.parse(raw) as SupplementReminderConfig[];
  const config = configs.find((c) => c.supplementId === supplementId);
  if (!config?.timeBasedEnabled) return;

  await scheduleTimeReminder(
    userId,
    config.supplementId,
    config.name,
    config.defaultAmount,
    config.unit,
    config.reminderTime,
  );
}

function NotificationListener() {
  const { user } = useAuth();

  useEffect(() => {
    let subscription: { remove: () => void } | null = null;
    let cancelled = false;

    const setup = async () => {
      // No-op in Expo Go — Notifications module is never loaded there.
      const Notifications = await getNotifications();
      if (!Notifications || cancelled) return;

      subscription = Notifications.addNotificationResponseReceivedListener(
        (response) => {
          const data = response.notification.request.content.data as Record<
            string,
            unknown
          >;
          if (data?.type === "supplement_time_reminder" && user?.id) {
            void handleSupplementTimeReminderNotification(data, user.id);
          }
        },
      );
    };

    void setup();

    return () => {
      cancelled = true;
      if (subscription && typeof subscription.remove === "function") {
        subscription.remove();
      }
    };
  }, [user?.id]);

  return null;
}

// ─── Update Checker ───────────────────────────────────────────────────────────

function UpdateChecker() {
  const { AlertComponent } = useAlert();

  // useEffect(() => {
  //   const checkForUpdate = async () => {
  //     try {
  //       const response = await fetch(
  //         "https://api.github.com/repos/Superak0s/OwnLift-App/releases/latest",
  //       );
  //       // const release = (await response.json()) as {
  //       //   tag_name: string;
  //       //   assets: Array<{ name: string; browser_download_url: string }>;
  //       // };

  //       // const latestVersion = release.tag_name.replace(/^v/, "").split("-")[0]!;
  //       // const currentVersion = Constants.expoConfig?.version;

  //       // if (latestVersion !== currentVersion) {
  //       //   const apkUrl = release.assets.find((a) =>
  //       //     a.name.endsWith(".apk"),
  //       //   )?.browser_download_url

  //       //   alert(
  //       //     "Update Available",
  //       //     `Version ${latestVersion} is available. Do you want to download it?`,
  //       //     [
  //       //       { text: "Later", style: "cancel" },
  //       //       {
  //       //         text: "Download",
  //       //         onPress: () => {
  //       //           if (apkUrl) void Linking.openURL(apkUrl)
  //       //         },
  //       //       },
  //       //     ],
  //       //     "info",
  //       //   )
  //       // }
  //     } catch (e) {
  //       console.log("Update check failed:", e);
  //     }
  //   };
  //   void checkForUpdate();
  // }, []);

  return AlertComponent;
}

// ─── Main Tabs ────────────────────────────────────────────────────────────────

function MainTabs() {
  const { user } = useAuth();
  const { colors } = useTheme();

  useEffect(() => {
    if (Platform.OS !== "android") return;
    void hideNavBar();
    const subscription = AppState.addEventListener(
      "change",
      (nextState: AppStateStatus) => {
        if (nextState === "active") void hideNavBar();
      },
    );
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const initializeSupplementReminders = async () => {
      if (!user?.id) return;
      try {
        const notificationsReady = await initializeSupplementNotifications();
        if (!notificationsReady) return;
        const configsKey = `supplementReminderConfigs_user_${user.id}`;
        const raw = await getStorageItem(configsKey);
        const configs = raw
          ? (JSON.parse(raw) as Array<{
              locationBasedReminder?: boolean;
              enabled?: boolean;
            }>)
          : [];
        const anyLocationEnabled = configs.some(
          (c) => c.locationBasedReminder && c.enabled,
        );
        const isRegistered = await isLocationTaskRegistered();
        if (anyLocationEnabled && !isRegistered) {
          await registerLocationTask();
        } else if (!anyLocationEnabled && isRegistered) {
          await unregisterLocationTask();
        }
      } catch (error) {
        console.error("❌ Error initializing supplement reminders:", error);
      }
    };
    void initializeSupplementReminders();
  }, [user?.id]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        const { height } = require("react-native").Dimensions.get("window");
        const touchY = evt.nativeEvent.pageY;
        return touchY > height - 60 && gestureState.dy < -10;
      },
      onPanResponderRelease: (evt, gestureState) => {
        const { height } = require("react-native").Dimensions.get("window");
        const touchY = evt.nativeEvent.pageY;
        if (
          Platform.OS === "android" &&
          touchY > height - 60 &&
          gestureState.dy < -30
        ) {
          void showNavBarTemporarily(3000);
        }
      },
    }),
  ).current;

  return (
    <View
      style={{ flex: 1, backgroundColor: colors.background }}
      {...panResponder.panHandlers}
    >
      <NotificationListener />
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarShowLabel: false,
        }}
        tabBar={renderCustomTabBar}
      >
        <Tab.Screen
          name='Home'
          component={HomeScreen}
          options={{ tabBarIcon: HomeTabBarIcon }}
        />
        <Tab.Screen
          name='Workout'
          component={WorkoutScreen}
          options={{ tabBarIcon: WorkoutTabBarIcon }}
        />
        <Tab.Screen
          name='Plan'
          component={PlanScreen}
          options={{ tabBarIcon: PlanTabBarIcon }}
        />
        <Tab.Screen
          name='Analytics'
          component={AnalyticsScreen}
          options={{ tabBarIcon: AnalyticsTabBarIcon }}
        />
        <Tab.Screen
          name='Tracking'
          component={TrackingScreen}
          options={{ tabBarIcon: TrackingTabBarIcon }}
        />
        <Tab.Screen
          name='Supplements'
          component={SupplementsScreen}
          options={{ tabBarIcon: SupplementsTabBarIcon }}
        />
        <Tab.Screen
          name='Friends'
          component={FriendsScreen}
          options={{ tabBarIcon: FriendsTabBarIcon }}
        />
        <Tab.Screen
          name='Settings'
          component={SettingsScreen}
          options={{ tabBarIcon: SettingsTabBarIcon }}
        />
      </Tab.Navigator>
    </View>
  );
}

// ─── App Navigator ────────────────────────────────────────────────────────────

function AppNavigator() {
  const { isAuthenticated, isLoading } = useAuth();
  const { colors } = useTheme();

  if (isLoading) {
    return (
      <View
        style={[
          styles.loadingContainer,
          { backgroundColor: colors.background },
        ]}
      >
        <Text style={styles.loadingText}>💪</Text>
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated ? (
        <Stack.Screen name='Main' component={MainTabs} />
      ) : (
        <>
          <Stack.Screen name='Login' component={LoginScreen} />
          <Stack.Screen name='Signup' component={SignupScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <TabBarProvider>
              <TrackingModalsProvider>
                <WorkoutProvider>
                  <NavigationContainer>
                    <StatusBar style='auto' />
                    <VersionGuard>
                      <UpdateChecker />
                      <AppNavigator />
                    </VersionGuard>
                  </NavigationContainer>
                </WorkoutProvider>
              </TrackingModalsProvider>
            </TabBarProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  customTabBarContainer: {
    position: "absolute",
    bottom: 0,
    left: 20,
    height: 73,
    width: "76%",
    borderRadius: 24,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    ...Platform.select({
      ios: { shadowOpacity: 0.3 },
      android: { elevation: 15 },
    }),
  },
  tabBarBackground: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 24,
    overflow: "hidden",
  },
  gradient: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 5,
    alignItems: "center",
    minWidth: "100%",
  },
  tabButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  tabIconContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 5,
    minWidth: 65,
  },
  iconWrapper: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
    backgroundColor: "transparent",
  },
  icon: { fontSize: 24 },
  label: {
    fontSize: 10,
    fontWeight: "600",
    color: "#9ca3af",
    marginTop: 2,
    letterSpacing: 0.3,
  },
  toggleContainer: {
    position: "absolute",
    bottom: 15,
    right: 20,
    zIndex: 1000,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleButton: {
    width: 46,
    height: 46,
    borderRadius: 16,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  toggleGradient: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  toggleArrow: { fontSize: 20, color: "#ffffff", fontWeight: "bold" },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: { fontSize: 64 },
});
