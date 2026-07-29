import type * as vscode from "vscode";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuthService } from "../src/services/authService";
import { BrowserAuthFlowError, BrowserAuthService } from "../src/services/browserAuthService";
import { BrowserSessionCaptureError } from "../src/services/chromiumBrowserAuth";

interface TestCancellationToken extends vscode.CancellationToken {
  cancel(): void;
}

function cancellationToken(initiallyCanceled = false): TestCancellationToken {
  const listeners = new Set<() => void>();
  return {
    isCancellationRequested: initiallyCanceled,
    onCancellationRequested: (listener: () => void) => {
      listeners.add(listener);
      return { dispose: () => listeners.delete(listener) };
    },
    cancel() {
      this.isCancellationRequested = true;
      for (const listener of listeners) listener();
    }
  } as TestCancellationToken;
}

function authService(): {
  auth: AuthService;
  importSession: ReturnType<typeof vi.fn>;
} {
  const importSession = vi.fn().mockResolvedValue({ id: "user-id", displayName: "GPU User" });
  return {
    auth: { importSession } as unknown as AuthService,
    importSession
  };
}

function waitForAbort(signal: AbortSignal): Promise<never> {
  return new Promise((_resolve, reject) => {
    const rejectWithReason = () => reject(signal.reason);
    if (signal.aborted) rejectWithReason();
    else signal.addEventListener("abort", rejectWithReason, { once: true });
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("BrowserAuthService", () => {
  const profileRoot = "/extension-storage/browser-auth-profile";

  it("imports the session captured from the dedicated browser profile", async () => {
    const { auth, importSession } = authService();
    const capture = vi.fn().mockResolvedValue('{"refresh_token":"captured-refresh"}');
    const service = new BrowserAuthService(auth, profileRoot, capture);

    await expect(service.signIn("github", cancellationToken()))
      .resolves.toMatchObject({ id: "user-id" });
    expect(capture).toHaveBeenCalledWith("github", expect.any(AbortSignal), profileRoot);
    expect(importSession).toHaveBeenCalledWith('{"refresh_token":"captured-refresh"}');
  });

  it("cancels the controlled browser flow", async () => {
    const { auth } = authService();
    const capture = vi.fn((_provider, signal: AbortSignal) => waitForAbort(signal));
    const service = new BrowserAuthService(auth, profileRoot, capture);
    const token = cancellationToken();
    const signIn = service.signIn("google", token);
    const rejection = expect(signIn).rejects.toEqual(
      new BrowserAuthFlowError("Browser sign-in was canceled.", "canceled")
    );
    await vi.waitFor(() => expect(capture).toHaveBeenCalledOnce());

    token.cancel();
    await rejection;
  });

  it("does not launch a browser when cancellation was already requested", async () => {
    const { auth } = authService();
    const capture = vi.fn();
    const service = new BrowserAuthService(auth, profileRoot, capture);

    await expect(service.signIn("github", cancellationToken(true)))
      .rejects.toMatchObject({ reason: "canceled" });
    expect(capture).not.toHaveBeenCalled();
  });

  it("expires an unanswered browser flow after ten minutes", async () => {
    vi.useFakeTimers();
    const { auth } = authService();
    const capture = vi.fn((_provider, signal: AbortSignal) => waitForAbort(signal));
    const service = new BrowserAuthService(auth, profileRoot, capture);
    const signIn = service.signIn("github", cancellationToken());
    const rejection = expect(signIn).rejects.toMatchObject({ reason: "timeout" });
    await vi.advanceTimersByTimeAsync(0);

    await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
    await rejection;
  });

  it("replaces an active browser flow before starting the next one", async () => {
    const { auth } = authService();
    const capture = vi.fn()
      .mockImplementationOnce((_provider, signal: AbortSignal) => waitForAbort(signal))
      .mockResolvedValueOnce('{"refresh_token":"second-refresh"}');
    const service = new BrowserAuthService(auth, profileRoot, capture);
    const first = service.signIn("github", cancellationToken());
    const firstRejection = expect(first).rejects.toEqual(
      new BrowserAuthFlowError("A newer browser sign-in was started.", "canceled")
    );
    await vi.waitFor(() => expect(capture).toHaveBeenCalledTimes(1));

    const second = service.signIn("google", cancellationToken());
    await firstRejection;
    await expect(second).resolves.toMatchObject({ id: "user-id" });
    expect(capture).toHaveBeenCalledTimes(2);
  });

  it("preserves browser availability and launch failure reasons", async () => {
    const { auth } = authService();
    const unavailable = new BrowserAuthService(auth, profileRoot, async () => {
      throw new BrowserSessionCaptureError("No supported browser.", "unavailable");
    });
    const launch = new BrowserAuthService(auth, profileRoot, async () => {
      throw new BrowserSessionCaptureError("Browser failed to start.", "launch");
    });

    await expect(unavailable.signIn("github", cancellationToken()))
      .rejects.toEqual(new BrowserAuthFlowError("No supported browser.", "unavailable"));
    await expect(launch.signIn("google", cancellationToken()))
      .rejects.toEqual(new BrowserAuthFlowError("Browser failed to start.", "launch"));
  });
});
