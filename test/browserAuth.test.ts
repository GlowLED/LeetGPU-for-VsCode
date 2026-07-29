import { describe, expect, it, vi } from "vitest";
import { takeLeetGpuSessionFromStorage } from "../src/services/chromiumBrowserAuth";
import {
  buildBrowserAuthorizationUrl,
  chromiumExecutableCandidates,
  findChromiumExecutable,
  parseDevToolsActivePort
} from "../src/utils/browserAuth";

describe("controlled browser authentication helpers", () => {
  it("takes only a complete Supabase session and removes its LeetGPU storage entry", () => {
    const entries = new Map([
      ["theme", "dark"],
      ["sb-incomplete-auth-token", '{"access_token":"access-only"}'],
      ["sb-project-auth-token", '{"access_token":"secret","refresh_token":"refresh-secret"}']
    ]);
    const storage = {
      get length() { return entries.size; },
      key: (index: number) => [...entries.keys()][index] ?? null,
      getItem: (key: string) => entries.get(key) ?? null,
      removeItem: (key: string) => { entries.delete(key); }
    };

    expect(takeLeetGpuSessionFromStorage(storage)).toBe(
      '{"access_token":"secret","refresh_token":"refresh-secret"}'
    );
    expect(entries.has("sb-project-auth-token")).toBe(false);
    expect(entries.get("sb-incomplete-auth-token")).toBe('{"access_token":"access-only"}');
    expect(entries.get("theme")).toBe("dark");
  });

  it("uses LeetGPU's allowed callback without putting session values in the URL", () => {
    const url = new URL(buildBrowserAuthorizationUrl("github"));
    expect(url.pathname).toBe("/auth/v1/authorize");
    expect(url.searchParams.get("provider")).toBe("github");
    expect(url.searchParams.get("redirect_to")).toBe("https://leetgpu.com/auth/callback");
    expect(url.searchParams.has("access_token")).toBe(false);
    expect(url.searchParams.has("refresh_token")).toBe(false);
    expect(url.searchParams.has("code_challenge")).toBe(false);
  });

  it("requests the same Google scopes used by LeetGPU", () => {
    const url = new URL(buildBrowserAuthorizationUrl("google"));
    expect(url.searchParams.get("scopes")).toBe("email profile");
  });

  it("parses Chrome's active debugging endpoint", () => {
    expect(parseDevToolsActivePort("45678\n/devtools/browser/identifier\n"))
      .toEqual({ port: 45678, browserPath: "/devtools/browser/identifier" });
    expect(parseDevToolsActivePort("not-a-port\n/devtools/browser/id")) .toBeUndefined();
    expect(parseDevToolsActivePort("70000\n/devtools/browser/id")) .toBeUndefined();
    expect(parseDevToolsActivePort("45678\ninvalid")) .toBeUndefined();
  });

  it("lists supported browser locations for macOS and Windows", () => {
    expect(chromiumExecutableCandidates("darwin")).toContain(
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    );
    expect(chromiumExecutableCandidates("win32", {
      LOCALAPPDATA: "C:\\Users\\test\\AppData\\Local",
      PROGRAMFILES: "C:\\Program Files"
    })).toEqual(expect.arrayContaining([
      expect.stringContaining("Google"),
      expect.stringContaining("Microsoft"),
      expect.stringContaining("BraveSoftware")
    ]));
  });

  it("expands Linux browser names through PATH", () => {
    const candidates = chromiumExecutableCandidates("linux", { PATH: "/first:/second" });
    expect(candidates).toContain("/first/google-chrome");
    expect(candidates).toContain("/second/chromium");
  });

  it("returns the first executable browser candidate", async () => {
    const isExecutable = vi.fn(async (path: string) => path.includes("Microsoft Edge"));
    await expect(findChromiumExecutable({ platform: "darwin", env: {}, isExecutable }))
      .resolves.toBe("/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge");
    expect(isExecutable).toHaveBeenCalledTimes(2);
  });
});
