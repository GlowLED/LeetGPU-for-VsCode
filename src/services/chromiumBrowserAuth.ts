import { spawn, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { once } from "node:events";
import WebSocket from "ws";
import { extractRefreshTokenFromJson } from "../utils/authInput";
import {
  buildBrowserAuthorizationUrl,
  findChromiumExecutable,
  parseDevToolsActivePort,
  type BrowserAuthProvider,
  type DevToolsEndpoint
} from "../utils/browserAuth";

const BROWSER_START_TIMEOUT_MS = 15_000;
const SESSION_POLL_INTERVAL_MS = 250;
const DEVTOOLS_CALL_TIMEOUT_MS = 3_000;

export type BrowserSessionCaptureFailureReason = "unavailable" | "launch" | "capture";

export class BrowserSessionCaptureError extends Error {
  public constructor(message: string, public readonly reason: BrowserSessionCaptureFailureReason) {
    super(message);
  }
}

interface DevToolsTarget {
  type?: string;
  url?: string;
  webSocketDebuggerUrl?: string;
}

export async function captureBrowserSession(
  provider: BrowserAuthProvider,
  signal: AbortSignal,
  profileRoot: string
): Promise<string> {
  throwIfAborted(signal);
  const executable = await findChromiumExecutable();
  if (!executable) {
    throw new BrowserSessionCaptureError(
      "Automatic sign-in requires Google Chrome, Microsoft Edge, Brave, or Chromium on this computer.",
      "unavailable"
    );
  }

  const browserProfileId = createHash("sha256").update(executable).digest("hex").slice(0, 16);
  const profileDirectory = join(profileRoot, browserProfileId);
  await mkdir(profileDirectory, { recursive: true });
  await rm(join(profileDirectory, "DevToolsActivePort"), { force: true });
  const lifecycle = new AbortController();
  const forwardAbort = () => lifecycle.abort(signal.reason);
  signal.addEventListener("abort", forwardAbort, { once: true });
  let browser: ChildProcess | undefined;
  let stopping = false;
  let sessionJson: string | undefined;
  let failure: unknown;
  let cleanupFailure = false;

  try {
    try {
      browser = spawn(executable, [
        `--user-data-dir=${profileDirectory}`,
        "--remote-debugging-address=127.0.0.1",
        "--remote-debugging-port=0",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-sync",
        "--new-window",
        buildBrowserAuthorizationUrl(provider)
      ], {
        stdio: "ignore",
        windowsHide: false
      });
    } catch (cause) {
      throw new BrowserSessionCaptureError(
        cause instanceof Error ? cause.message : "Could not launch a browser for LeetGPU sign-in.",
        "launch"
      );
    }

    browser.once("error", (error) => {
      lifecycle.abort(new BrowserSessionCaptureError(error.message, "launch"));
    });
    browser.once("exit", () => {
      if (!stopping) {
        lifecycle.abort(new BrowserSessionCaptureError(
          "The dedicated browser closed before LeetGPU sign-in completed.",
          "capture"
        ));
      }
    });

    const endpoint = await waitForDevToolsEndpoint(profileDirectory, lifecycle.signal);
    sessionJson = await waitForLeetGpuSession(endpoint, lifecycle.signal);
  } catch (cause) {
    failure = cause;
  } finally {
    stopping = true;
    signal.removeEventListener("abort", forwardAbort);
    try {
      await stopBrowser(browser);
    } catch {
      cleanupFailure = true;
    }
  }

  if (cleanupFailure) {
    throw new BrowserSessionCaptureError(
      "The dedicated sign-in browser could not be closed cleanly.",
      "capture"
    );
  }
  if (failure) throw failure;
  if (!sessionJson) {
    throw new BrowserSessionCaptureError("The dedicated browser did not return a LeetGPU session.", "capture");
  }
  return sessionJson;
}

async function waitForDevToolsEndpoint(
  profileDirectory: string,
  signal: AbortSignal
): Promise<DevToolsEndpoint> {
  const activePortFile = join(profileDirectory, "DevToolsActivePort");
  const deadline = Date.now() + BROWSER_START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    throwIfAborted(signal);
    try {
      const endpoint = parseDevToolsActivePort(await readFile(activePortFile, "utf8"));
      if (endpoint) return endpoint;
    } catch {
      // Chrome creates DevToolsActivePort after the new profile has initialized.
    }
    await delay(100, signal);
  }
  throw new BrowserSessionCaptureError("The dedicated browser did not start in time.", "launch");
}

async function waitForLeetGpuSession(endpoint: DevToolsEndpoint, signal: AbortSignal): Promise<string> {
  const targetsUrl = `http://127.0.0.1:${endpoint.port}/json/list`;
  let consecutiveReadFailures = 0;
  let lastReadFailure: BrowserSessionCaptureError | undefined;
  while (true) {
    throwIfAborted(signal);
    try {
      const response = await fetch(targetsUrl, { signal });
      if (response.ok) {
        const targets = await response.json() as DevToolsTarget[];
        const target = targets.find((candidate) =>
          candidate.type === "page" &&
          typeof candidate.url === "string" &&
          isLeetGpuUrl(candidate.url) &&
          typeof candidate.webSocketDebuggerUrl === "string"
        );
        if (target?.webSocketDebuggerUrl) {
          try {
            const value = await readLeetGpuSession(target.webSocketDebuggerUrl, signal);
            consecutiveReadFailures = 0;
            lastReadFailure = undefined;
            if (value && extractRefreshTokenFromJson(value)) return value;
          } catch (cause) {
            if (signal.aborted) throw abortReason(signal);
            lastReadFailure = cause instanceof BrowserSessionCaptureError
              ? cause
              : new BrowserSessionCaptureError("Could not read the dedicated browser session.", "capture");
            consecutiveReadFailures += 1;
            if (consecutiveReadFailures >= 20) throw lastReadFailure;
          }
        }
      }
    } catch (cause) {
      if (signal.aborted) throw abortReason(signal);
      if (cause === lastReadFailure) throw cause;
      // Navigation can briefly invalidate the target; retry until sign-in completes or is canceled.
    }
    await delay(SESSION_POLL_INTERVAL_MS, signal);
  }
}

function isLeetGpuUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "leetgpu.com";
  } catch {
    return false;
  }
}

async function readLeetGpuSession(webSocketUrl: string, signal: AbortSignal): Promise<string | undefined> {
  throwIfAborted(signal);
  return new Promise<string | undefined>((resolve, reject) => {
    const socket = new WebSocket(webSocketUrl.replace("localhost", "127.0.0.1"));
    const timeout = setTimeout(() => finish(
      new BrowserSessionCaptureError("The browser debugging connection timed out.", "capture")
    ), DEVTOOLS_CALL_TIMEOUT_MS);
    const onAbort = () => finish(abortReason(signal));
    let finished = false;

    const finish = (error?: unknown, value?: string): void => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      signal.removeEventListener("abort", onAbort);
      socket.close();
      if (error) reject(error);
      else resolve(value);
    };

    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted) {
      onAbort();
      return;
    }
    socket.once("open", () => {
      socket.send(JSON.stringify({
        id: 1,
        method: "Runtime.evaluate",
        params: {
          expression: `(${takeLeetGpuSessionFromStorage.toString()})(localStorage)`,
          returnByValue: true
        }
      }));
    });
    socket.on("message", (data) => {
      try {
        const message = JSON.parse(data.toString()) as {
          id?: number;
          error?: { message?: string };
          result?: { result?: { value?: unknown } };
        };
        if (message.id !== 1) return;
        if (message.error) {
          finish(new BrowserSessionCaptureError(
            message.error.message ?? "The browser rejected the session read.",
            "capture"
          ));
          return;
        }
        const value = message.result?.result?.value;
        finish(undefined, typeof value === "string" ? value : undefined);
      } catch {
        finish(new BrowserSessionCaptureError("The browser returned an invalid debugging response.", "capture"));
      }
    });
    socket.once("error", (error) => finish(new BrowserSessionCaptureError(error.message, "capture")));
    socket.once("close", () => finish(new BrowserSessionCaptureError(
      "The browser debugging connection closed unexpectedly.",
      "capture"
    )));
  });
}

interface BrowserStorage {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  removeItem(key: string): void;
}

/** Captures and removes only a complete Supabase auth session from LeetGPU local storage. */
export function takeLeetGpuSessionFromStorage(storage: BrowserStorage): string | undefined {
  const containsRefreshToken = (value: unknown): boolean => {
    if (!value || typeof value !== "object") return false;
    if (Array.isArray(value)) return value.some(containsRefreshToken);
    const record = value as Record<string, unknown>;
    if (typeof record.refresh_token === "string" && record.refresh_token.length > 0) return true;
    return Object.values(record).some(containsRefreshToken);
  };

  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key || !key.startsWith("sb-") || !key.endsWith("-auth-token")) continue;
    const value = storage.getItem(key);
    if (!value) continue;
    try {
      if (!containsRefreshToken(JSON.parse(value))) continue;
    } catch {
      continue;
    }
    storage.removeItem(key);
    return value;
  }
  return undefined;
}

export async function resetBrowserAuthProfile(profileRoot: string): Promise<void> {
  await rm(profileRoot, { recursive: true, force: true, maxRetries: 8, retryDelay: 200 });
}

async function stopBrowser(browser: ChildProcess | undefined): Promise<void> {
  if (!browser || browser.exitCode !== null) return;
  const exited = once(browser, "exit").then(() => true);
  browser.kill();
  if (await Promise.race([exited, delayWithoutSignal(1_500).then(() => false)])) return;
  browser.kill("SIGKILL");
  await Promise.race([exited, delayWithoutSignal(500)]);
}

function delay(milliseconds: number, signal: AbortSignal): Promise<void> {
  throwIfAborted(signal);
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => finish(), milliseconds);
    const onAbort = () => finish(abortReason(signal));
    let finished = false;
    const finish = (error?: unknown): void => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      signal.removeEventListener("abort", onAbort);
      if (error) reject(error);
      else resolve();
    };
    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted) onAbort();
  });
}

function delayWithoutSignal(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw abortReason(signal);
}

function abortReason(signal: AbortSignal): unknown {
  return signal.reason ?? new Error("Browser sign-in was canceled.");
}
