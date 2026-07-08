// services/contactsMatching.ts
import * as Contacts from "expo-contacts"
import * as Crypto from "expo-crypto"

export type ContactsPermissionResult = "granted" | "denied" | "undetermined"

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/**
 * Requests (or checks) the OS contacts permission.
 * Uses getPermissionsAsync first so we don't re-prompt if already decided.
 */
export const requestContactsPermission =
  async (): Promise<ContactsPermissionResult> => {
    const existing = await Contacts.getPermissionsAsync()
    if (existing.status === "granted") return "granted"
    if (!existing.canAskAgain) return "denied"

    const requested = await Contacts.requestPermissionsAsync()
    return requested.status === "granted" ? "granted" : "denied"
  }

/**
 * Reads all device contacts with an email address, normalizes each email
 * (trim + lowercase), dedupes them, then hashes every one with SHA-256.
 *
 * Only the resulting hashes are meant to leave the device — the raw email
 * list should never be sent anywhere.
 */
export const getHashedContactEmails = async (): Promise<string[]> => {
  const { data } = await Contacts.getContactsAsync({
    fields: [Contacts.Fields.Emails],
  })

  const emails = new Set<string>()
  for (const contact of data) {
    contact.emails?.forEach((entry) => {
      if (entry.email) emails.add(normalizeEmail(entry.email))
    })
  }

  const hashes = await Promise.all(
    Array.from(emails).map((email) =>
      Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, email),
    ),
  )

  return hashes
}

export interface ContactSuggestionsResult {
  status: "granted" | "denied"
  hashes: string[]
}

/**
 * Full flow used by the UI: ask for permission, and if granted, read +
 * hash contact emails. Returns status so the caller can show the right
 * empty state if permission was denied.
 */
export const collectHashedContactEmails =
  async (): Promise<ContactSuggestionsResult> => {
    const permission = await requestContactsPermission()
    if (permission !== "granted") {
      return { status: "denied", hashes: [] }
    }
    const hashes = await getHashedContactEmails()
    return { status: "granted", hashes }
  }
