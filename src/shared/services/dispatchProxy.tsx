/**
 * Builds a proxy object with the same method names as `onImpl`/`offImpl`,
 * where every call is dispatched to one or the other based on
 * isServerless() *at call time* — so flipping the Settings toggle takes
 * effect immediately, with no app restart required.
 *
 * This exists mainly to sidestep a TypeScript quirk: building this kind of
 * proxy key-by-key inside a `reduce` over a concrete object type (where
 * each method has a different signature) makes TS check every assignment
 * against the intersection of *all* method signatures, which nothing
 * satisfies. Here the intermediate proxy is typed uniformly and the
 * concrete shape is only asserted once, at the end.
 */
import { isServerless } from "./appMode"

export function createDispatchProxy<
  T extends Record<string, (...args: any[]) => any>,
>(onImpl: T, offImpl: T): T {
  const keys = Object.keys(onImpl) as Array<keyof T>
  const proxy = {} as Record<keyof T, (...args: unknown[]) => unknown>

  for (const key of keys) {
    proxy[key] = (...args: unknown[]) => {
      const impl = isServerless() ? offImpl : onImpl
      return impl[key](...args)
    }
  }

  return proxy as T
}
