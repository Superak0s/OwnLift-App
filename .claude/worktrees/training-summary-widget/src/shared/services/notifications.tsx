import Constants, { ExecutionEnvironment } from "expo-constants";

const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export type NotificationsModule = typeof import("expo-notifications");
let cachedNotifications: NotificationsModule | null = null;

export async function getNotifications(): Promise<NotificationsModule | null> {
  if (isExpoGo) return null;
  if (!cachedNotifications) {
    cachedNotifications = await import("expo-notifications");
  }
  return cachedNotifications;
}

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
