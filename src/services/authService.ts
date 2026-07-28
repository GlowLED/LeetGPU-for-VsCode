import * as vscode from "vscode";
import { AUTH_SECRET_KEY, SUPABASE_ANON_KEY, SUPABASE_URL } from "../constants";
import type { AuthUser, StoredSession } from "../models";
import { extractRefreshToken } from "../utils/authInput";

interface SupabaseSessionResponse {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  expires_in?: number;
  user: {
    id: string;
    email?: string;
    user_metadata?: Record<string, unknown>;
  };
}

export class AuthError extends Error {
  public constructor(message: string, public readonly status?: number) {
    super(message);
  }
}

export class AuthService implements vscode.Disposable {
  private cachedSession: StoredSession | undefined;
  private refreshPromise: Promise<StoredSession> | undefined;
  private readonly subscriptions: vscode.Disposable[] = [];

  public constructor(private readonly secrets: vscode.SecretStorage) {
    this.subscriptions.push(
      secrets.onDidChange((event) => {
        if (event.key === AUTH_SECRET_KEY) {
          this.cachedSession = undefined;
        }
      })
    );
  }

  public dispose(): void {
    for (const subscription of this.subscriptions) {
      subscription.dispose();
    }
  }

  public async importSession(input: string): Promise<AuthUser> {
    const refreshToken = extractRefreshToken(input);
    if (!refreshToken) {
      throw new AuthError("No refresh_token was found in the pasted value.");
    }

    const session = await this.exchangeRefreshToken(refreshToken);
    await this.save(session);
    return session.user;
  }

  public async completeAuthorizationCode(authCode: string, codeVerifier: string): Promise<AuthUser> {
    if (!authCode || !codeVerifier) throw new AuthError("The browser sign-in callback was incomplete.");
    const session = await this.exchangeSession("pkce", {
      auth_code: authCode,
      code_verifier: codeVerifier
    });
    await this.save(session);
    return session.user;
  }

  public async getUser(): Promise<AuthUser | undefined> {
    const session = await this.load();
    return session?.user;
  }

  public async isConnected(): Promise<boolean> {
    return Boolean(await this.load());
  }

  public async getAccessToken(forceRefresh = false): Promise<string> {
    const session = await this.load();
    if (!session) {
      throw new AuthError("Not connected to LeetGPU.", 401);
    }

    if (!forceRefresh && session.expiresAt * 1000 > Date.now() + 120_000) {
      return session.accessToken;
    }

    const refreshed = await this.refresh(session);
    return refreshed.accessToken;
  }

  public async disconnect(): Promise<void> {
    this.cachedSession = undefined;
    await this.secrets.delete(AUTH_SECRET_KEY);
  }

  private async refresh(session: StoredSession): Promise<StoredSession> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.refreshWithLatestToken(session).finally(() => {
      this.refreshPromise = undefined;
    });
    return this.refreshPromise;
  }

  private async refreshWithLatestToken(original: StoredSession): Promise<StoredSession> {
    const latest = (await this.readSecret()) ?? original;
    try {
      const refreshed = await this.exchangeRefreshToken(latest.refreshToken);
      await this.save(refreshed);
      return refreshed;
    } catch (error) {
      const afterFailure = await this.readSecret();
      if (afterFailure && afterFailure.refreshToken !== latest.refreshToken) {
        const refreshed = await this.exchangeRefreshToken(afterFailure.refreshToken);
        await this.save(refreshed);
        return refreshed;
      }
      throw error;
    }
  }

  private async exchangeRefreshToken(refreshToken: string): Promise<StoredSession> {
    return this.exchangeSession("refresh_token", { refresh_token: refreshToken });
  }

  private async exchangeSession(
    grantType: "refresh_token" | "pkce",
    requestBody: Record<string, string>
  ): Promise<StoredSession> {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=${grantType}`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      let message = `Authentication failed (${response.status}).`;
      try {
        const body = await response.json() as { msg?: string; message?: string; error_description?: string };
        message = body.error_description ?? body.message ?? body.msg ?? message;
      } catch {
        // Keep the status-only message and never include a token or raw response.
      }
      throw new AuthError(message, response.status);
    }

    const body = await response.json() as SupabaseSessionResponse;
    if (!body.access_token || !body.refresh_token || !body.user?.id) {
      throw new AuthError("LeetGPU returned an incomplete session.");
    }

    const metadata = body.user.user_metadata ?? {};
    return {
      accessToken: body.access_token,
      refreshToken: body.refresh_token,
      expiresAt: body.expires_at ?? Math.floor(Date.now() / 1000) + (body.expires_in ?? 3600),
      user: {
        id: body.user.id,
        email: body.user.email,
        displayName: stringValue(metadata.full_name) ?? stringValue(metadata.name) ?? body.user.email,
        avatarUrl: stringValue(metadata.avatar_url)
      }
    };
  }

  private async load(): Promise<StoredSession | undefined> {
    if (this.cachedSession) {
      return this.cachedSession;
    }
    this.cachedSession = await this.readSecret();
    return this.cachedSession;
  }

  private async readSecret(): Promise<StoredSession | undefined> {
    const raw = await this.secrets.get(AUTH_SECRET_KEY);
    if (!raw) {
      return undefined;
    }
    try {
      const parsed = JSON.parse(raw) as StoredSession;
      if (
        typeof parsed.accessToken !== "string" ||
        typeof parsed.refreshToken !== "string" ||
        typeof parsed.expiresAt !== "number" ||
        typeof parsed.user?.id !== "string"
      ) {
        return undefined;
      }
      return parsed;
    } catch {
      return undefined;
    }
  }

  private async save(session: StoredSession): Promise<void> {
    this.cachedSession = session;
    await this.secrets.store(AUTH_SECRET_KEY, JSON.stringify(session));
  }
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
