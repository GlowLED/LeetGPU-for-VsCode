import { createHash, randomBytes } from "node:crypto";
import { SUPABASE_URL } from "../constants";

export type BrowserAuthProvider = "github" | "google";

export interface PkceCredentials {
  state: string;
  verifier: string;
  challenge: string;
}

export interface BrowserAuthCallback {
  state?: string;
  code?: string;
  error?: string;
}

export function createPkceCredentials(): PkceCredentials {
  const verifier = randomBytes(32).toString("base64url");
  return {
    state: randomBytes(24).toString("base64url"),
    verifier,
    challenge: pkceChallenge(verifier)
  };
}

export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function buildBrowserAuthorizationUrl(
  provider: BrowserAuthProvider,
  redirectTo: string,
  challenge: string
): string {
  const url = new URL(`${SUPABASE_URL}/auth/v1/authorize`);
  url.searchParams.set("provider", provider);
  url.searchParams.set("redirect_to", redirectTo);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "s256");
  if (provider === "google") url.searchParams.set("scopes", "email profile");
  return url.toString();
}

export function parseBrowserAuthCallback(query: string, fragment = ""): BrowserAuthCallback {
  const queryParams = new URLSearchParams(query);
  const fragmentParams = new URLSearchParams(fragment);
  const value = (key: string): string | undefined => queryParams.get(key) ?? fragmentParams.get(key) ?? undefined;
  return {
    state: value("state"),
    code: value("code"),
    error: value("error_description") ?? value("error")
  };
}
