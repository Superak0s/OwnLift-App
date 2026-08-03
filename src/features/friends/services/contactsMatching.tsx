import * as Contacts from "expo-contacts"
import * as Crypto from "expo-crypto"

export type ContactsPermissionResult = "granted" | "denied" | "undetermined"

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export const requestContactsPermission =
  async (): Promise<ContactsPermissionResult> => {
    const existing = await Contacts.getPermissionsAsync()
    if (existing.status === "granted") return "granted"
    if (!existing.canAskAgain) return "denied"

    const requested = await Contacts.requestPermissionsAsync()
    return requested.status === "granted" ? "granted" : "denied"
  }

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

export const collectHashedContactEmails =
  async (): Promise<ContactSuggestionsResult> => {
    const permission = await requestContactsPermission()
    if (permission !== "granted") {
      return { status: "denied", hashes: [] }
    }
    const hashes = await getHashedContactEmails()
    return { status: "granted", hashes }
  }
