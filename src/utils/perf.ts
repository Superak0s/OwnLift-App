import { useEffect, useLayoutEffect, useRef } from "react";
import log from "@shared/services/logger";

const now = (): number =>
  typeof globalThis.performance?.now === "function"
    ? globalThis.performance.now()
    : Date.now();

export const perfLog = (label: string, ms: number, extra = ""): void => {
  if (!__DEV__) return;
  log.debug(`[perf] ${label}: ${ms.toFixed(1)}ms${extra ? ` ${extra}` : ""}`);
};

export const timed = <T>(label: string, fn: () => T, extra = ""): T => {
  if (!__DEV__) return fn();
  const start = now();
  const result = fn();
  perfLog(label, now() - start, extra);
  return result;
};

export const startTimer = (): (() => number) => {
  const start = now();
  return () => now() - start;
};

// A tick that should land every 100ms but lands much later means the JS thread
// was blocked by synchronous work in between, wherever it came from.
export const watchJsStalls = (thresholdMs = 120): void => {
  if (!__DEV__) return;
  let last = now();
  setInterval(() => {
    const drift = now() - last - 100;
    if (drift > thresholdMs) log.debug(`[perf] JS THREAD BLOCKED ~${drift.toFixed(0)}ms`);
    last = now();
  }, 100);
};

export const logCaller = (label: string): void => {
  if (!__DEV__) return;
  const stack = new Error().stack?.split(String.fromCharCode(10)).slice(2, 7).join(" | ") ?? "?";
  log.debug(`[perf] ${label} called from: ${stack}`);
};

// Splits a render into the component's own body vs everything React does after
// it (children, siblings under the same provider, commit), which is where a
// stall that isn't in this component shows up.
export const useRenderTimer = (label: string): (() => void) => {
  const timer = startTimer();
  const count = useRef(0);
  const bodyMs = useRef(0);
  count.current += 1;
  useLayoutEffect(() => {
    perfLog(`${label}.commit`, timer() - bodyMs.current, `#${count.current} body=${bodyMs.current.toFixed(1)}ms`);
  });
  useEffect(() => {
    perfLog(`${label}.total`, timer(), `#${count.current}`);
  });
  return () => {
    bodyMs.current = timer();
  };
};

export const onRenderProfiler = (
  id: string,
  phase: string,
  actualDuration: number,
): void => {
  if (!__DEV__ || actualDuration < 16) return;
  log.debug(`[perf] ${id} ${phase}: ${actualDuration.toFixed(1)}ms`);
};
