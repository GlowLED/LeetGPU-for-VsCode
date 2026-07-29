import type * as vscode from "vscode";
import type { AuthUser } from "../models";
import type { BrowserAuthProvider } from "../utils/browserAuth";
import {
  captureBrowserSession,
  BrowserSessionCaptureError,
  resetBrowserAuthProfile
} from "./chromiumBrowserAuth";
import type { AuthService } from "./authService";

const AUTH_TIMEOUT_MS = 10 * 60 * 1000;

export type BrowserAuthFailureReason = "canceled" | "timeout" | "unavailable" | "launch" | "capture";

export class BrowserAuthFlowError extends Error {
  public constructor(message: string, public readonly reason: BrowserAuthFailureReason) {
    super(message);
  }
}

export type BrowserSessionCapture = (
  provider: BrowserAuthProvider,
  signal: AbortSignal,
  profileRoot: string
) => Promise<string>;

interface ActiveBrowserAuth {
  controller: AbortController;
  settled: Promise<void>;
  settle(): void;
}

export class BrowserAuthService implements vscode.Disposable {
  private active: ActiveBrowserAuth | undefined;

  public constructor(
    private readonly auth: AuthService,
    private readonly profileRoot: string,
    private readonly captureSession: BrowserSessionCapture = captureBrowserSession
  ) {}

  public async signIn(
    provider: BrowserAuthProvider,
    cancellationToken: vscode.CancellationToken
  ): Promise<AuthUser> {
    await this.cancelActive(new BrowserAuthFlowError("A newer browser sign-in was started.", "canceled"));
    if (cancellationToken.isCancellationRequested) {
      throw new BrowserAuthFlowError("Browser sign-in was canceled.", "canceled");
    }

    const controller = new AbortController();
    let settle!: () => void;
    const settled = new Promise<void>((resolve) => {
      settle = resolve;
    });
    const active: ActiveBrowserAuth = { controller, settled, settle };
    this.active = active;
    const timeout = setTimeout(() => {
      controller.abort(new BrowserAuthFlowError("Browser sign-in timed out.", "timeout"));
    }, AUTH_TIMEOUT_MS);
    const cancellation = cancellationToken.onCancellationRequested(() => {
      controller.abort(new BrowserAuthFlowError("Browser sign-in was canceled.", "canceled"));
    });

    try {
      if (cancellationToken.isCancellationRequested) {
        controller.abort(new BrowserAuthFlowError("Browser sign-in was canceled.", "canceled"));
      }
      const sessionJson = await this.captureSession(provider, controller.signal, this.profileRoot);
      throwIfAborted(controller.signal);
      return await this.auth.importSession(sessionJson);
    } catch (cause) {
      if (controller.signal.aborted) throw abortReason(controller.signal);
      if (cause instanceof BrowserSessionCaptureError) {
        throw new BrowserAuthFlowError(cause.message, cause.reason);
      }
      if (cause instanceof BrowserAuthFlowError) throw cause;
      throw new BrowserAuthFlowError(
        cause instanceof Error ? cause.message : "Could not capture the LeetGPU browser session.",
        "capture"
      );
    } finally {
      clearTimeout(timeout);
      cancellation.dispose();
      if (this.active === active) this.active = undefined;
      active.settle();
    }
  }

  public dispose(): void {
    this.active?.controller.abort(new BrowserAuthFlowError("Browser sign-in was canceled.", "canceled"));
  }

  public async resetProfile(): Promise<void> {
    await this.cancelActive(new BrowserAuthFlowError("Browser sign-in was canceled.", "canceled"));
    await resetBrowserAuthProfile(this.profileRoot);
  }

  private async cancelActive(reason: BrowserAuthFlowError): Promise<void> {
    const active = this.active;
    if (!active) return;
    active.controller.abort(reason);
    await active.settled;
  }
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw abortReason(signal);
}

function abortReason(signal: AbortSignal): BrowserAuthFlowError {
  return signal.reason instanceof BrowserAuthFlowError
    ? signal.reason
    : new BrowserAuthFlowError("Browser sign-in was canceled.", "canceled");
}
