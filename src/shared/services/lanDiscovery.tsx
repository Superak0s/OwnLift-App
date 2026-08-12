import { Platform } from "react-native"
import Zeroconf from "react-native-zeroconf"

const SCAN_TIMEOUT_MS = 4000
const LOG_PREFIX = "[lanDiscovery]"

export type LanServer = {
  ip: string
  port: number
  fqdn: string | null
}

type ZeroconfService = {
  name: string
  host: string
  port: number
  addresses: string[]
  txt?: Record<string, string>
}

// Android emulators don't support multicast, so scanning there will always
// time out with zero results — that's expected, not a bug.
export const scanForLanServer = (): Promise<LanServer | null> => {
  console.log(`${LOG_PREFIX} starting scan for _ownlift._tcp on ${Platform.OS}`)
  const zeroconf = new Zeroconf()

  return new Promise((resolve) => {
    let settled = false
    const finish = (result: LanServer | null) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      zeroconf.stop()
      zeroconf.removeAllListeners()
      resolve(result)
    }

    zeroconf.on("start", () => console.log(`${LOG_PREFIX} scan started`))
    zeroconf.on("error", (err: Error) => console.log(`${LOG_PREFIX} error:`, err?.message ?? err))
    zeroconf.on("resolved", (service: ZeroconfService) => {
      console.log(`${LOG_PREFIX} resolved service:`, JSON.stringify(service))
      const ip = service.addresses?.find((addr) => addr.includes("."))
      if (!ip) {
        console.log(`${LOG_PREFIX} resolved service has no IPv4 address, ignoring`)
        return
      }
      finish({ ip, port: service.port, fqdn: service.txt?.fqdn || null })
    })

    const timer = setTimeout(() => {
      console.log(`${LOG_PREFIX} scan timed out after ${SCAN_TIMEOUT_MS}ms, no server found`)
      finish(null)
    }, SCAN_TIMEOUT_MS)

    zeroconf.scan("ownlift", "tcp", "local.")
  })
}
