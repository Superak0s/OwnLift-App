import { createManagedState } from "./managedState"

// Default server URL
const DEFAULT_API_BASE_URL = "https://ownlift.superak0s.com"

const serverUrlState = createManagedState<string>("@server_url", DEFAULT_API_BASE_URL)

// Initialize on module load (same fire-and-forget pattern as before)
serverUrlState.ensureLoaded()

export const setServerUrl = serverUrlState.set
export const getServerUrl = serverUrlState.get
export const getDefaultServerUrl = (): string => DEFAULT_API_BASE_URL
export const resetServerUrl = serverUrlState.reset
export const onServerUrlChange = serverUrlState.onChange
