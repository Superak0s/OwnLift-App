import { create, act } from "react-test-renderer";
import { AuthProvider } from "../AuthContext";

jest.mock("@features/auth/services/index", () => ({
  authService: {
    isAuthenticated: jest.fn().mockResolvedValue(true),
    getCurrentUser: jest.fn().mockResolvedValue({ id: 1, username: "tester" }),
    refreshToken: jest.fn().mockResolvedValue("new-token"),
    logout: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock("@shared/services/config", () => ({
  onServerUrlChange: jest.fn(() => () => {}),
}));

jest.mock("@shared/services/appMode", () => ({
  getAppMode: jest.fn().mockResolvedValue("online"),
  isServerless: jest.fn().mockResolvedValue(false),
  onAppModeChange: { subscribe: jest.fn(() => () => {}) },
}));

jest.mock("@shared/services/tokenStorage", () => ({
  tokenStorage: { get: jest.fn().mockResolvedValue("stored-token") },
}));

jest.mock("@shared/services/debugClock", () => ({
  sinceBoot: jest.fn(() => 0),
}));

import { authService } from "@features/auth/services/index";

const refreshTokenMock = authService.refreshToken as jest.Mock;

const TOKEN_REFRESH_INTERVAL_MS = 55 * 60 * 1000;

describe("AuthProvider proactive refresh timer", () => {
  beforeEach(() => {
    refreshTokenMock.mockClear();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("refreshes the token every TOKEN_REFRESH_INTERVAL_MS once authenticated, and stops after unmount", async () => {
    let root: ReturnType<typeof create>;
    await act(async () => {
      root = create(
        <AuthProvider>
          <></>
        </AuthProvider>,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(refreshTokenMock).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(TOKEN_REFRESH_INTERVAL_MS);
      await Promise.resolve();
    });
    expect(refreshTokenMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(TOKEN_REFRESH_INTERVAL_MS);
      await Promise.resolve();
    });
    expect(refreshTokenMock).toHaveBeenCalledTimes(2);

    act(() => {
      root!.unmount();
    });

    await act(async () => {
      jest.advanceTimersByTime(TOKEN_REFRESH_INTERVAL_MS * 2);
      await Promise.resolve();
    });
    expect(refreshTokenMock).toHaveBeenCalledTimes(2);
  });
});
