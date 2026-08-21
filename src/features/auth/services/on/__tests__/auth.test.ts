import { authService } from "../auth"
import { tokenStorage } from "@shared/services/tokenStorage"
import { setStorageItem } from "@shared/services/sqliteStorage"

jest.mock("@shared/services/config", () => ({
  getServerUrl: jest.fn(() => "https://api.example.com"),
}))

jest.mock("@shared/services/tokenStorage", () => ({
  tokenStorage: { set: jest.fn().mockResolvedValue(undefined) },
}))

jest.mock("@shared/services/sqliteStorage", () => ({
  setStorageItem: jest.fn().mockResolvedValue(undefined),
  getStorageItem: jest.fn().mockResolvedValue(null),
  removeStorageItem: jest.fn().mockResolvedValue(undefined),
}))

const setTokenMock = tokenStorage.set as jest.Mock
const setStorageItemMock = setStorageItem as jest.Mock

describe("authService signin/signup network flow", () => {
  beforeEach(() => {
    setTokenMock.mockClear()
    setStorageItemMock.mockClear()
    globalThis.fetch = jest.fn()
  })

  it("stores token and user on successful signin", async () => {
    ;(globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        token: "abc123",
        user: { id: 1, username: "tester" },
      }),
    })

    const result = await authService.signin("tester", "pw")

    expect(result.success).toBe(true)
    expect(setTokenMock).toHaveBeenCalledWith("abc123")
    expect(setStorageItemMock).toHaveBeenCalledWith(
      "@user",
      JSON.stringify({ id: 1, username: "tester" }),
    )
  })

  it("does not store a token when the server rejects credentials", async () => {
    ;(globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ success: false, error: "Invalid credentials" }),
    })

    await expect(authService.signin("tester", "wrong")).rejects.toThrow(
      "Invalid credentials",
    )
    expect(setTokenMock).not.toHaveBeenCalled()
  })

  it("propagates a network failure without storing anything", async () => {
    ;(globalThis.fetch as jest.Mock).mockRejectedValue(new Error("Network request failed"))

    await expect(authService.signin("tester", "pw")).rejects.toThrow(
      "Network request failed",
    )
    expect(setTokenMock).not.toHaveBeenCalled()
  })

  it("stores token and user on successful signup", async () => {
    ;(globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        token: "xyz789",
        user: { id: 2, username: "newbie" },
      }),
    })

    const result = await authService.signup("newbie", "n@e.com", "pw")

    expect(result.success).toBe(true)
    expect(setTokenMock).toHaveBeenCalledWith("xyz789")
  })

  it("propagates a network failure on signup without storing anything", async () => {
    ;(globalThis.fetch as jest.Mock).mockRejectedValue(new Error("Network request failed"))

    await expect(authService.signup("newbie", "n@e.com", "pw")).rejects.toThrow(
      "Network request failed",
    )
    expect(setTokenMock).not.toHaveBeenCalled()
  })
})
