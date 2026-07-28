import * as vscode from "vscode";
import { PENDING_AUTH_SECRET_KEY } from "../constants";
import type { AuthUser } from "../models";
import {
  buildBrowserAuthorizationUrl,
  createPkceCredentials,
  parseBrowserAuthCallback,
  type BrowserAuthProvider
} from "../utils/browserAuth";
import type { AuthService } from "./authService";

const AUTH_CALLBACK_PATH = "/auth/callback";
const AUTH_TIMEOUT_MS = 10 * 60 * 1000;

interface PendingBrowserAuth {
  state: string;
  verifier: string;
  expiresAt: number;
}

interface ActiveCompletion {
  state: string;
  resolve(user: AuthUser): void;
  reject(error: Error): void;
  timeout: ReturnType<typeof setTimeout>;
  cancellation: vscode.Disposable;
}

export type BrowserAuthFailureReason = "canceled" | "timeout" | "callback" | "launch";

export class BrowserAuthFlowError extends Error {
  public constructor(message: string, public readonly reason: BrowserAuthFailureReason) {
    super(message);
  }
}

export class BrowserAuthService implements vscode.Disposable {
  private readonly authenticatedEmitter = new vscode.EventEmitter<AuthUser>();
  private activeCompletion: ActiveCompletion | undefined;
  public readonly onDidAuthenticate = this.authenticatedEmitter.event;

  public constructor(
    private readonly secrets: vscode.SecretStorage,
    private readonly auth: AuthService,
    private readonly extensionId: string
  ) {}

  public async signIn(
    provider: BrowserAuthProvider,
    cancellationToken: vscode.CancellationToken
  ): Promise<AuthUser> {
    await this.cancelActive(new BrowserAuthFlowError("A newer browser sign-in was started.", "canceled"));
    const credentials = createPkceCredentials();
    const callback = vscode.Uri.from({
      scheme: vscode.env.uriScheme,
      authority: this.extensionId,
      path: AUTH_CALLBACK_PATH,
      query: new URLSearchParams({ state: credentials.state }).toString()
    });
    const externalCallback = await vscode.env.asExternalUri(callback);
    const pending: PendingBrowserAuth = {
      state: credentials.state,
      verifier: credentials.verifier,
      expiresAt: Date.now() + AUTH_TIMEOUT_MS
    };
    await this.secrets.store(PENDING_AUTH_SECRET_KEY, JSON.stringify(pending));

    const completion = new Promise<AuthUser>((resolve, reject) => {
      const timeout = setTimeout(() => {
        void this.fail(
          credentials.state,
          new BrowserAuthFlowError("Browser sign-in timed out before VS Code received a callback.", "timeout")
        );
      }, AUTH_TIMEOUT_MS);
      const active: ActiveCompletion = {
        state: credentials.state,
        resolve,
        reject,
        timeout,
        cancellation: new vscode.Disposable(() => {})
      };
      this.activeCompletion = active;
      active.cancellation = cancellationToken.onCancellationRequested(() => {
        void this.fail(credentials.state, new BrowserAuthFlowError("Browser sign-in was canceled.", "canceled"));
      });
      if (cancellationToken.isCancellationRequested) {
        void this.fail(credentials.state, new BrowserAuthFlowError("Browser sign-in was canceled.", "canceled"));
      }
    });

    const authorizationUrl = buildBrowserAuthorizationUrl(
      provider,
      externalCallback.toString(true),
      credentials.challenge
    );
    try {
      const opened = await vscode.env.openExternal(vscode.Uri.parse(authorizationUrl));
      if (opened) return completion;
      await this.fail(
        credentials.state,
        new BrowserAuthFlowError("VS Code could not open the browser for LeetGPU sign-in.", "launch")
      );
    } catch (cause) {
      const error = cause instanceof Error
        ? new BrowserAuthFlowError(cause.message, "launch")
        : new BrowserAuthFlowError("VS Code could not open the browser for LeetGPU sign-in.", "launch");
      await this.fail(credentials.state, error);
    }
    return completion;
  }

  public async handleUri(uri: vscode.Uri): Promise<AuthUser | undefined> {
    if (uri.path !== AUTH_CALLBACK_PATH) return undefined;
    const callback = parseBrowserAuthCallback(uri.query, uri.fragment);
    const pending = await this.readPending();
    if (!pending || !callback.state || callback.state !== pending.state) {
      throw new BrowserAuthFlowError("Rejected a browser sign-in callback with an invalid state.", "callback");
    }
    if (pending.expiresAt <= Date.now()) {
      const error = new BrowserAuthFlowError("The browser sign-in callback expired. Start sign-in again.", "timeout");
      const handled = await this.fail(pending.state, error);
      if (!handled) throw error;
      return undefined;
    }
    if (callback.error) {
      const error = new BrowserAuthFlowError(`LeetGPU browser sign-in failed: ${callback.error}`, "callback");
      const handled = await this.fail(pending.state, error);
      if (!handled) throw error;
      return undefined;
    }
    if (!callback.code) {
      const error = new BrowserAuthFlowError("The browser sign-in callback did not contain an authorization code.", "callback");
      const handled = await this.fail(pending.state, error);
      if (!handled) throw error;
      return undefined;
    }

    try {
      const user = await this.auth.completeAuthorizationCode(callback.code, pending.verifier);
      await this.clearPending(pending.state);
      this.resolveActive(pending.state, user);
      this.authenticatedEmitter.fire(user);
      return user;
    } catch (cause) {
      const error = cause instanceof Error ? cause : new Error("LeetGPU browser sign-in failed.");
      const handled = await this.fail(pending.state, error);
      if (!handled) throw error;
      return undefined;
    }
  }

  public dispose(): void {
    const active = this.activeCompletion;
    if (active) {
      clearTimeout(active.timeout);
      active.cancellation.dispose();
      void this.clearPending(active.state);
      active.reject(new BrowserAuthFlowError("Browser sign-in was canceled.", "canceled"));
      this.activeCompletion = undefined;
    }
    this.authenticatedEmitter.dispose();
  }

  private async cancelActive(error: Error): Promise<void> {
    const active = this.activeCompletion;
    if (!active) return;
    await this.clearPending(active.state);
    this.rejectActive(active.state, error);
  }

  private async fail(state: string, error: Error): Promise<boolean> {
    await this.clearPending(state);
    return this.rejectActive(state, error);
  }

  private resolveActive(state: string, user: AuthUser): boolean {
    const active = this.activeCompletion;
    if (!active || active.state !== state) return false;
    clearTimeout(active.timeout);
    active.cancellation.dispose();
    this.activeCompletion = undefined;
    active.resolve(user);
    return true;
  }

  private rejectActive(state: string, error: Error): boolean {
    const active = this.activeCompletion;
    if (!active || active.state !== state) return false;
    clearTimeout(active.timeout);
    active.cancellation.dispose();
    this.activeCompletion = undefined;
    active.reject(error);
    return true;
  }

  private async readPending(): Promise<PendingBrowserAuth | undefined> {
    const raw = await this.secrets.get(PENDING_AUTH_SECRET_KEY);
    if (!raw) return undefined;
    try {
      const value = JSON.parse(raw) as Partial<PendingBrowserAuth>;
      if (typeof value.state !== "string" || typeof value.verifier !== "string" || typeof value.expiresAt !== "number") {
        return undefined;
      }
      return value as PendingBrowserAuth;
    } catch {
      return undefined;
    }
  }

  private async clearPending(state: string): Promise<void> {
    const pending = await this.readPending();
    if (pending?.state === state) await this.secrets.delete(PENDING_AUTH_SECRET_KEY);
  }
}
