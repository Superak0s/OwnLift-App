import { type ReactNode } from "react"

// Server version compatibility used to be checked here, but the check was
// always a stub that reported the client as compatible with itself — so the
// "incompatible version" UI could never render. Removed; this is now a
// pass-through wrapper. Re-add real version checking here if/when the server
// exposes a version endpoint to check against.
interface VersionGuardProps {
  readonly children: ReactNode
}

export function VersionGuard({ children }: VersionGuardProps) {
  return <>{children}</>
}
