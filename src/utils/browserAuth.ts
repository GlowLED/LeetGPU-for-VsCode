import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { delimiter, join } from "node:path";
import { SUPABASE_URL } from "../constants";

export type BrowserAuthProvider = "github" | "google";

export interface DevToolsEndpoint {
  port: number;
  browserPath: string;
}

export interface BrowserLookupOptions {
  platform?: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
  isExecutable?: (path: string) => Promise<boolean>;
}

const LEETGPU_AUTH_CALLBACK = "https://leetgpu.com/auth/callback";

export function buildBrowserAuthorizationUrl(provider: BrowserAuthProvider): string {
  const url = new URL(`${SUPABASE_URL}/auth/v1/authorize`);
  url.searchParams.set("provider", provider);
  url.searchParams.set("redirect_to", LEETGPU_AUTH_CALLBACK);
  if (provider === "google") url.searchParams.set("scopes", "email profile");
  return url.toString();
}

export function parseDevToolsActivePort(raw: string): DevToolsEndpoint | undefined {
  const [portLine, browserPath] = raw.trim().split(/\r?\n/, 2);
  const port = Number(portLine);
  if (!Number.isInteger(port) || port <= 0 || port > 65_535 || !browserPath?.startsWith("/")) return undefined;
  return { port, browserPath };
}

export async function findChromiumExecutable(options: BrowserLookupOptions = {}): Promise<string | undefined> {
  const platform = options.platform ?? process.platform;
  const env = options.env ?? process.env;
  const isExecutable = options.isExecutable ?? defaultIsExecutable;
  for (const candidate of chromiumExecutableCandidates(platform, env)) {
    if (await isExecutable(candidate)) return candidate;
  }
  return undefined;
}

export function chromiumExecutableCandidates(
  platform: NodeJS.Platform,
  env: NodeJS.ProcessEnv = process.env
): string[] {
  if (platform === "darwin") {
    return [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
      "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
      "/Applications/Chromium.app/Contents/MacOS/Chromium"
    ];
  }

  if (platform === "win32") {
    const roots = [env.LOCALAPPDATA, env.PROGRAMFILES, env["PROGRAMFILES(X86)"]].filter(
      (value): value is string => Boolean(value)
    );
    const relativePaths = [
      ["Google", "Chrome", "Application", "chrome.exe"],
      ["Microsoft", "Edge", "Application", "msedge.exe"],
      ["BraveSoftware", "Brave-Browser", "Application", "brave.exe"]
    ];
    return roots.flatMap((root) => relativePaths.map((parts) => join(root, ...parts)));
  }

  const names = [
    "google-chrome",
    "google-chrome-stable",
    "microsoft-edge",
    "microsoft-edge-stable",
    "brave-browser",
    "chromium",
    "chromium-browser"
  ];
  return (env.PATH ?? "")
    .split(delimiter)
    .filter(Boolean)
    .flatMap((directory) => names.map((name) => join(directory, name)));
}

async function defaultIsExecutable(path: string): Promise<boolean> {
  try {
    await access(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}
