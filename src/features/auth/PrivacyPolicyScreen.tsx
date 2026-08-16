import React, { useMemo } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@shared/context/ThemeContext";
import type { RootStackParamList } from "./types";

type PrivacyPolicyScreenProps = {
  readonly navigation: NativeStackNavigationProp<
    RootStackParamList,
    "PrivacyPolicy"
  >;
};

const SECTIONS: { title: string; body: string }[] = [
  {
    title: "Data we store",
    body:
      "OwnLift works fully offline by default: your workouts, plans, supplements, and settings are stored only on your device using local SQLite storage. Nothing is sent anywhere unless you turn on server sync.",
  },
  {
    title: "Optional server sync",
    body:
      "If you switch to online mode and create an account, your workout data, plan, and profile sync to the server you configure (the default is OwnLift's own server) so you can use the app across devices and with friends. You can switch back to offline mode at any time; your device keeps working with local data only.",
  },
  {
    title: "Account data",
    body:
      "In online mode we store your username, email, and password (hashed, never in plain text) to authenticate you. Friend features may share your username and workout activity with people you've added as friends.",
  },
  {
    title: "Location",
    body:
      "Location permissions are used only for optional supplement reminders that trigger near a place you choose (e.g. \"remind me at the gym\"). Location is processed on-device and is not uploaded to any server.",
  },
  {
    title: "No ads, no analytics sale",
    body:
      "OwnLift does not show ads, does not sell your data, and does not use third-party advertising trackers.",
  },
  {
    title: "Crash reports",
    body:
      "If a crash reporting service is enabled, anonymized crash and error diagnostics may be sent to help us fix bugs. This never includes your workout data, password, or location.",
  },
  {
    title: "Your control",
    body:
      "You can delete your account and server-stored data from Settings, or uninstall the app to remove all local data from your device.",
  },
  {
    title: "Contact",
    body: "Questions about this policy? Reach out at kostissuperak0s@gmail.com.",
  },
];

export default function PrivacyPolicyScreen({
  navigation,
}: PrivacyPolicyScreenProps): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Privacy Policy</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.updated}>Last updated: August 2026</Text>
        {SECTIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionBody}>{section.body}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: {
  background: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
}) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingVertical: 16,
    },
    backButton: { marginRight: 12 },
    backButtonText: { color: colors.accent, fontSize: 16, fontWeight: "600" },
    title: { fontSize: 20, fontWeight: "700", color: colors.textPrimary },
    content: { paddingHorizontal: 20, paddingBottom: 40 },
    updated: { fontSize: 12, color: colors.textMuted, marginBottom: 20 },
    section: { marginBottom: 20 },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.textPrimary,
      marginBottom: 6,
    },
    sectionBody: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
    },
  });
