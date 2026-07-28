import { describe, expect, it } from "vitest";
import {
  buildBrowserAuthorizationUrl,
  parseBrowserAuthCallback,
  pkceChallenge
} from "../src/utils/browserAuth";

describe("browser authentication helpers", () => {
  it("creates the expected SHA-256 PKCE challenge", () => {
    expect(pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"))
      .toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });

  it("builds a GitHub authorization URL without putting secrets in it", () => {
    const callback = "vscode://glowled.leetgpu/auth/callback?state=state-value";
    const url = new URL(buildBrowserAuthorizationUrl("github", callback, "challenge-value"));
    expect(url.pathname).toBe("/auth/v1/authorize");
    expect(url.searchParams.get("provider")).toBe("github");
    expect(url.searchParams.get("redirect_to")).toBe(callback);
    expect(url.searchParams.get("code_challenge")).toBe("challenge-value");
    expect(url.searchParams.get("code_challenge_method")).toBe("s256");
    expect(url.searchParams.has("refresh_token")).toBe(false);
  });

  it("requests the same Google scopes used by LeetGPU", () => {
    const url = new URL(buildBrowserAuthorizationUrl("google", "vscode://callback", "challenge"));
    expect(url.searchParams.get("scopes")).toBe("email profile");
  });

  it("parses successful and failed callbacks", () => {
    expect(parseBrowserAuthCallback("state=one&code=two"))
      .toEqual({ state: "one", code: "two", error: undefined });
    expect(parseBrowserAuthCallback("state=one&error=access_denied&error_description=User+cancelled"))
      .toEqual({ state: "one", code: undefined, error: "User cancelled" });
    expect(parseBrowserAuthCallback("state=one", "code=fragment-code"))
      .toEqual({ state: "one", code: "fragment-code", error: undefined });
  });
});
