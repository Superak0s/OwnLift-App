import Constants from 'expo-constants'
import { getServerUrl } from './config'

const MINIMUM_SERVER_VERSION = '1.1.0'

export interface ParsedVersion {
  major: number
  minor: number
  patch: number
}

export interface VersionCompatibility {
  compatible: boolean
  reason: string | null
}

export interface ServerVersionResult {
  success: boolean
  version: string | null
  parsed?: ParsedVersion
  error?: string
}

export interface ValidationResult {
  compatible: boolean
  clientVersion: string
  serverVersion: string | null
  reason?: string
}

/**
 * Parse semantic version string into { major, minor, patch }
 */
export function parseVersion(versionString: string): ParsedVersion {
  const parts = versionString.split('.')
  return {
    major: parseInt(parts[0] ?? '0', 10),
    minor: parseInt(parts[1] ?? '0', 10),
    patch: parseInt(parts[2] ?? '0', 10),
  }
}

/**
 * Compare two version objects.
 * Returns -1 if a < b, 0 if equal, 1 if a > b.
 */
export function compareVersions(a: ParsedVersion, b: ParsedVersion): -1 | 0 | 1 {
  if (a.major !== b.major) return a.major < b.major ? -1 : 1
  if (a.minor !== b.minor) return a.minor < b.minor ? -1 : 1
  if (a.patch !== b.patch) return a.patch < b.patch ? -1 : 1
  return 0
}

/**
 * Check if server version meets minimum requirements.
 */
export function checkVersionCompatibility(
  serverVersionString: string,
  minVersionString: string,
): VersionCompatibility {
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

    return { compatible: true, reason: null }
  } catch (error) {
    console.error('❌ Error checking version compatibility:', error)
    return {
      compatible: false,
      reason: 'Unable to verify server version. Please try again later.',
    }
  }
}

/**
 * Fetch server version from API.
 */
export async function fetchServerVersion(): Promise<ServerVersionResult> {
  try {
    const serverUrl = getServerUrl()
    const response = await fetch(`${serverUrl}/api/version`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: Unable to fetch server version`)
    }

    const data = await response.json()
    return {
      success: true,
      version: data.version || '0.0.0',
      parsed: data.parsed || parseVersion(data.version || '0.0.0'),
    }
  } catch (error) {
    console.error('❌ Error fetching server version:', (error as Error).message)
    return {
      success: false,
      version: null,
      error: (error as Error).message,
    }
  }
}

/**
 * Get client app version from Expo Constants.
 */
export function getClientVersion(): string {
  return Constants.expoConfig?.version ?? '0.0.0'
}

/**
 * Validate that the server meets the client's minimum version requirements.
 */
export async function validateServerVersion(): Promise<ValidationResult> {
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
    serverData.version!,
    MINIMUM_SERVER_VERSION,
  )

  return {
    compatible: compatibility.compatible,
    clientVersion,
    serverVersion: serverData.version,
    reason: compatibility.reason ?? undefined,
  }
}
