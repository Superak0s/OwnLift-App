declare module "react-native-zeroconf" {
  export default class Zeroconf {
    on(event: string, listener: (...args: any[]) => void): this
    removeAllListeners(): void
    scan(type?: string, protocol?: string, domain?: string): void
    stop(): void
  }
}
