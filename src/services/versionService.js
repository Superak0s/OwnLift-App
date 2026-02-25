// src/services/versionService.js
import Constants from "expo-constants"
import { getServerUrl } from "./config"
const MINIMUM_SERVER_VERSION = "1.1.0"

/**
 * Parse semantic version string into {major, minor, patch}
 * @param {string} versionString - e.g., "1.2.3"
 * @returns {{major: number, minor: number, patch: number}}
 */
export function parseVersion(versionString) {
  const parts = versionString.split(".")
  return {
    major: parseInt(parts[0] || 0, 10),
    minor: parseInt(parts[1] || 0, 10),
    patch: parseInt(parts[2] || 0, 10),
  }
}

/**
 * Compare two version objects
 * @param {object} clientVersion - {major, minor, patch}
 * @param {object} serverVersion - {major, minor, patch}
 * @returns {number} -1 if client < server, 0 if equal, 1 if client > server
 */
export function compareVersions(clientVersion, serverVersion) {
  if (clientVersion.major !== serverVersion.major) {
    return clientVersion.major < serverVersion.major ? -1 : 1
  }
  if (clientVersion.minor !== serverVersion.minor) {
    return clientVersion.minor < serverVersion.minor ? -1 : 1
  }
  if (clientVersion.patch !== serverVersion.patch) {
    return clientVersion.patch < serverVersion.patch ? -1 : 1
  }
  return 0
}

/**
 * Check if server version meets minimum requirements
 * @param {string} serverVersionString - Server version from API
 * @param {string} minVersionString - Minimum required version (e.g., "1.5.0")
 * @returns {{compatible: boolean, reason: string}}
 */
export function checkVersionCompatibility(
  serverVersionString,
  minVersionString,
) {
  try {
    const serverVersion = parseVersion(serverVersionString)
    const minVersion = parseVersion(minVersionString)

    const comparison = compareVersions(serverVersion, minVersion)

    if (comparison < 0) {
      return {
        compatible: false,
        reason: `Server version ${serverVersionString} is outdated. Minimum required: ${minVersionString}. Please ask your server administrator to upgrade.`,
      }
    }

    return {
      compatible: true,
      reason: null,
    }
  } catch (error) {
    console.error("❌ Error checking version compatibility:", error)
    return {
      compatible: false,
      reason: "Unable to verify server version. Please try again later.",
    }
  }
}

/**
 * Fetch server version from API
 * @returns {Promise<{success: boolean, version: string, parsed?: object, error?: string}>}
 */
export async function fetchServerVersion() {
  try {
    const serverUrl = getServerUrl()
    const response = await fetch(`${serverUrl}/api/version`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: Unable to fetch server version`)
    }

    const data = await response.json()
    return {
      success: true,
      version: data.version || "0.0.0",
      parsed: data.parsed || parseVersion(data.version || "0.0.0"),
    }
  } catch (error) {
    console.error("❌ Error fetching server version:", error.message)
    return {
      success: false,
      version: null,
      error: error.message,
    }
  }
}

/**
 * Get client app version from Constants
 * @returns {string} Client app version
 */
export function getClientVersion() {
  return Constants.expoConfig?.version || "0.0.0"
}

/**
 * Validate server meets client's minimum version requirements
 * Client should not connect to servers older than a certain version
 *
 * MINIMUM_SERVER_VERSION should match your app's requirements
 * Example: "1.5.0" means server must be at least v1.5.0
 *
 * @returns {Promise<{compatible: boolean, clientVersion: string, serverVersion: string, reason?: string}>}
 */
export async function validateServerVersion() {
  // Define minimum server version required by this client
  // Update this whenever you introduce breaking changes

  const clientVersion = getClientVersion()
  const serverData = await fetchServerVersion()

  if (!serverData.success) {
    return {
      compatible: false,
      clientVersion,
      serverVersion: null,
      reason: `Unable to connect to server: ${serverData.error}`,
    }
  }

  const compatibility = checkVersionCompatibility(
    serverData.version,
    MINIMUM_SERVER_VERSION,
  )

  return {
    compatible: compatibility.compatible,
    clientVersion,
    serverVersion: serverData.version,
    reason: compatibility.reason,
  }
}
