import { isServerless } from "./appMode"

export function createDispatchProxy<
  T extends Record<string, (...args: any[]) => any>,
>(onImpl: T, offImpl: T): T {
  const keys = Object.keys(onImpl) as Array<keyof T>
  const proxy = {} as Record<keyof T, (...args: unknown[]) => unknown>

  for (const key of keys) {
    proxy[key] = async (...args: unknown[]) => {
      const impl = (await isServerless()) ? offImpl : onImpl
      return impl[key](...args)
    }
  }

  return proxy as T
}
