import { LogBox } from "react-native"
import * as Updates from "expo-updates"

LogBox.ignoreLogs([
  "expo-notifications: Android Push notifications",
  "`expo-notifications` functionality is not fully supported in Expo Go",
  "expo-notifications",
])
import React, { useState, useEffect, useRef } from "react"
import { NavigationContainer } from "@react-navigation/native"
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs"
import { StatusBar } from "expo-status-bar"
import {
  View,
  StyleSheet,
  Platform,
  Text,
  TouchableOpacity,
  Animated,
  PanResponder,
  ScrollView,
  Keyboard,
  Alert,
} from "react-native"
import Constants from "expo-constants"
import * as Linking from "expo-linking"

import { LinearGradient } from "expo-linear-gradient"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { AuthProvider, useAuth } from "./src/context/AuthContext"
import { WorkoutProvider } from "./src/context/WorkoutContext"
import * as NavigationBar from "expo-navigation-bar"
import AsyncStorage from "@react-native-async-storage/async-storage"
import * as Notifications from "expo-notifications"
import { rescheduleTimeReminder } from "./tasks/creatineLocationTask"

import LoginScreen from "./src/screens/LoginScreen"
import SignupScreen from "./src/screens/SignupScreen"
import HomeScreen from "./src/screens/HomeScreen"
import WorkoutScreen from "./src/screens/WorkoutScreen"
import AnalyticsScreen from "./src/screens/AnalyticsScreen"
import TrackingScreen from "./src/screens/TrackingScreen"
import FriendsScreen from "./src/screens/FriendsScreen"
import SettingsScreen from "./src/screens/SettingsScreen"

import {
  registerLocationTask,
  unregisterLocationTask,
  isLocationTaskRegistered,
  initializeCreatineNotifications,
  clearOldReminderKeys,
} from "./tasks/creatineLocationTask"

const Stack = createNativeStackNavigator()
const Tab = createBottomTabNavigator()

try {
  if (Notifications && Notifications.setNotificationHandler) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    })
  }
} catch (error) {
  console.log("Notifications not available in Expo Go:", error.message)
}
const TabIcon = ({ icon, label, focused }) => {
  return (
    <View style={styles.tabIconContainer}>
      <View style={[styles.iconWrapper, focused && styles.iconWrapperActive]}>
        <Text style={styles.icon}>{icon}</Text>
      </View>
      <Text style={[styles.label, focused && styles.labelActive]}>{label}</Text>
    </View>
  )
}

const CustomTabBar = ({ state, descriptors, navigation }) => {
  const scrollViewRef = useRef(null)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false)
  const slideAnim = useRef(new Animated.Value(0)).current
  const rotateAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const activeIndex = state.index
    if (scrollViewRef.current && activeIndex >= 3) {
      scrollViewRef.current.scrollTo({
        x: (activeIndex - 2) * 80,
        animated: true,
      })
    } else if (scrollViewRef.current && activeIndex < 3) {
      scrollViewRef.current.scrollTo({
        x: 0,
        animated: true,
      })
    }
  }, [state.index])

  const handleToggle = () => {
    const toValue = isCollapsed ? 0 : 1
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
    ]).start()
    setIsCollapsed(!isCollapsed)
  }

  const tabBarTranslateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -400],
  })

  const arrowTranslateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -330],
  })

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  })

  // opacity+pointerEvents instead of returning null — avoids hooks count mismatch
  return (
    <View
      style={{ opacity: isKeyboardVisible ? 0 : 1 }}
      pointerEvents={isKeyboardVisible ? "none" : "auto"}
    >
      <Animated.View
        style={[
          styles.customTabBarContainer,
          { transform: [{ translateX: tabBarTranslateX }] },
        ]}
      >
        <View style={styles.tabBarBackground}>
          <LinearGradient
            colors={["#ffffff", "#f8f9ff"]}
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
            const { options } = descriptors[route.key]
            const isFocused = state.index === index

            const onPress = () => {
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              })
              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name)
              }
            }

            const IconComponent = options.tabBarIcon

            return (
              <TouchableOpacity
                key={route.key}
                onPress={onPress}
                style={styles.tabButton}
                activeOpacity={0.7}
              >
                {IconComponent && IconComponent({ focused: isFocused })}
              </TouchableOpacity>
            )
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
            colors={["#667eea", "#764ba2"]}
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
  )
}

// Fixed: was calling addNotificationResponseReceivedListener twice
function NotificationListener() {
  const { user } = useAuth()

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      async (response) => {
        if (
          response.notification.request.content.data?.type ===
          "creatine_time_reminder"
        ) {
          const settingsKey = `creatineSettings_user_${user.id}`
          const settings = JSON.parse(await AsyncStorage.getItem(settingsKey))
          await rescheduleTimeReminder(
            user.id,
            settings.reminderTime,
            settings.defaultGrams,
          )
        }
      },
    )
    return () => {
      if (subscription && typeof subscription.remove === "function") {
        subscription.remove()
      }
    }
  }, [user?.id])

  return null
}

function MainTabs() {
  const { user } = useAuth()
  const [navBarVisible, setNavBarVisible] = useState(false)

  useEffect(() => {
    if (Platform.OS === "android") {
      NavigationBar.setVisibilityAsync("hidden")
      setNavBarVisible(false)
    }
  }, [])

  useEffect(() => {
    const initializeCreatineReminders = async () => {
      if (!user?.id) {
        console.log(
          "⚠️ No user logged in, skipping creatine reminder initialization",
        )
        return
      }
      try {
        console.log("🔄 Initializing creatine reminders on app startup...")
        const notificationsReady = await initializeCreatineNotifications()
        if (!notificationsReady) {
          console.log("⚠️ Notifications not ready")
          return
        }
        await clearOldReminderKeys(user.id)
        const creatineSettingsKey = `creatineSettings_user_${user.id}`
        const settingsStr = await AsyncStorage.getItem(creatineSettingsKey)
        if (!settingsStr) {
          console.log("ℹ️ No creatine settings found")
          return
        }
        const settings = JSON.parse(settingsStr)
        console.log("📋 Loaded creatine settings:", settings)
        if (settings.locationBasedReminder && settings.enabled) {
          console.log(
            "📍 Location-based reminders are enabled, checking task status...",
          )
          const isRegistered = await isLocationTaskRegistered()
          if (!isRegistered) {
            console.log("🚀 Registering location task...")
            const registered = await registerLocationTask()
            if (registered) {
              console.log("✅ Location task registered successfully on startup")
            } else {
              console.error("❌ Failed to register location task on startup")
            }
          } else {
            console.log("✅ Location task already registered")
          }
        } else {
          console.log("ℹ️ Location-based reminders not enabled")
          const isRegistered = await isLocationTaskRegistered()
          if (isRegistered) {
            console.log(
              "⏹️ Unregistering location task (disabled in settings)...",
            )
            await unregisterLocationTask()
          }
        }
      } catch (error) {
        console.error("❌ Error initializing creatine reminders:", error)
      }
    }
    initializeCreatineReminders()
  }, [user?.id])

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return gestureState.dy < -10 && gestureState.y0 > 700
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dy < -30 && Platform.OS === "android") {
          NavigationBar.setVisibilityAsync("visible")
          setNavBarVisible(true)
          setTimeout(() => {
            NavigationBar.setVisibilityAsync("hidden")
            setNavBarVisible(false)
          }, 3000)
        }
      },
    }),
  ).current

  return (
    <View style={{ flex: 1 }} {...panResponder.panHandlers}>
      <NotificationListener />
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: "#667eea",
          tabBarInactiveTintColor: "#9ca3af",
          tabBarShowLabel: false,
        }}
        tabBar={(props) => <CustomTabBar {...props} />}
      >
        <Tab.Screen
          name='Home'
          component={HomeScreen}
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon icon='🏠' label='Home' focused={focused} />
            ),
          }}
        />
        <Tab.Screen
          name='Workout'
          component={WorkoutScreen}
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon icon='💪' label='Workout' focused={focused} />
            ),
          }}
        />
        <Tab.Screen
          name='Analytics'
          component={AnalyticsScreen}
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon icon='📊' label='Progress' focused={focused} />
            ),
          }}
        />
        <Tab.Screen
          name='Tracking'
          component={TrackingScreen}
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon icon='📈' label='Track' focused={focused} />
            ),
          }}
        />
        <Tab.Screen
          name='Friends'
          component={FriendsScreen}
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon icon='👥' label='Friends' focused={focused} />
            ),
          }}
        />
        <Tab.Screen
          name='Settings'
          component={SettingsScreen}
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon icon='⚙️' label='Settings' focused={focused} />
            ),
          }}
        />
      </Tab.Navigator>

      {Platform.OS === "android" && (
        <View style={styles.hintContainer}>
          <Text style={styles.hintText}>
            Swipe up from bottom to show navigation buttons
          </Text>
        </View>
      )}
    </View>
  )
}

function AppNavigator() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>💪</Text>
      </View>
    )
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
  )
}

export default function App() {
  useEffect(() => {
    async function checkForUpdate() {
      try {
        const response = await fetch(
          "https://api.github.com/repos/Superak0s/SuperGym/releases/latest",
        )
        const release = await response.json()

        const latestVersion = release.tag_name.replace(/^v/, "").split("-")[0]
        const currentVersion = Constants.expoConfig.version

        if (latestVersion !== currentVersion) {
          const apkUrl = release.assets.find((a) =>
            a.name.endsWith(".apk"),
          )?.browser_download_url

          Alert.alert(
            "Update Available",
            `Version ${latestVersion} is available. Do you want to download it?`,
            [
              { text: "Later", style: "cancel" },
              { text: "Download", onPress: () => Linking.openURL(apkUrl) },
            ],
          )
        }
      } catch (e) {
        console.log("Update check failed:", e)
      }
    }
    checkForUpdate()
  }, [])
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <WorkoutProvider>
          <NavigationContainer>
            <StatusBar style='light' />
            <AppNavigator />
          </NavigationContainer>
        </WorkoutProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  customTabBarContainer: {
    position: "absolute",
    bottom: 25,
    left: 20,
    height: 73,
    width: "76%",
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: "#667eea",
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
  gradient: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
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
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
    backgroundColor: "transparent",
  },
  iconWrapperActive: {
    borderRadius: 16,
    backgroundColor: "#667eea",
    shadowColor: "#667eea",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  icon: {
    fontSize: 24,
  },
  label: {
    fontSize: 10,
    fontWeight: "600",
    color: "#9ca3af",
    marginTop: 2,
    letterSpacing: 0.3,
  },
  labelActive: {
    color: "#667eea",
    fontWeight: "700",
  },
  toggleContainer: {
    position: "absolute",
    bottom: 40,
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
    shadowColor: "#667eea",
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
  toggleArrow: {
    fontSize: 20,
    color: "#ffffff",
    fontWeight: "bold",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  loadingText: {
    fontSize: 64,
  },
  hintContainer: {
    position: "absolute",
    bottom: 5,
    left: 0,
    right: 0,
    alignItems: "center",
    opacity: 0.5,
  },
  hintText: {
    fontSize: 10,
    color: "#9ca3af",
    textAlign: "center",
  },
})
