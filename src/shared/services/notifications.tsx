import Constants, { ExecutionEnvironment } from "expo-constants";

// ─── Expo Go detection ─────────────────────────────────────────────────────
// expo-notifications warns/throws the moment it's `require`d inside Expo Go
// on Android (remote/push functionality was removed from Expo Go in SDK 53+).
// We never statically import it — we lazily `import()` it, and only outside
// Expo Go, so the module is never loaded at all when running in Expo Go.
const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export type NotificationsModule = typeof import("expo-notifications");
let cachedNotifications: NotificationsModule | null = null;

/**
 * Lazily load expo-notifications (only when NOT running inside Expo Go).
 * Callers use the returned module to configure handlers or send notifications.
 */
export async function getNotifications(): Promise<NotificationsModule | null> {
  if (isExpoGo) return null;
  if (!cachedNotifications) {
    cachedNotifications = await import("expo-notifications");
  }
  return cachedNotifications;
}

/**
 * Schedule a notification safely.
 * `sound: true` triggers "custom sound 'default' not found" in expo-notifications 57.x
 * because it coerces to the string "default" which isn't registered in app.json.
 * We strip `sound` so the notification channel's default (system sound) is used.
 */
export async function scheduleNotification(
  options: Parameters<NotificationsModule["scheduleNotificationAsync"]>[0],
): Promise<ReturnType<NotificationsModule["scheduleNotificationAsync"]>> {
  const Notifications = await getNotifications();
  if (!Notifications) throw new Error("Notifications unavailable");
  const { sound: _, ...content } = options.content;
  return Notifications.scheduleNotificationAsync({
    ...options,
    content,
  });
}
