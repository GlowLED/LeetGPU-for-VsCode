import { HTTP_API_URL } from "../constants";
import {
  assemblyResponseSchema,
  challengeDetailSchema,
  challengeSummarySchema,
  type AssemblyResponse,
  type AcceleratorResponse,
  type ChallengeDetail,
  type ChallengeSummary,
  type SubmissionFile
} from "../models";
import type { AuthService } from "./authService";

export class ApiError extends Error {
  public constructor(message: string, public readonly status?: number) {
    super(message);
  }
}

export class LeetGpuClient {
  public constructor(private readonly auth: AuthService) {}

  public async getChallenges(): Promise<ChallengeSummary[]> {
    const body = await this.getJson("/api/v1/challenges", false) as { challenges?: unknown[] };
    return (body.challenges ?? []).map((item) => challengeSummarySchema.parse(item));
  }

  public async getChallenge(id: number, signal?: AbortSignal): Promise<ChallengeDetail> {
    const body = await this.getJson(`/api/v1/challenges/${id}`, false, signal);
    return challengeDetailSchema.parse(body);
  }

  public async getProgress(): Promise<Record<string, string>> {
    const body = await this.getJson("/api/v1/challenges/progress", true) as {
      progressByChallengeId?: Record<string, string>;
    };
    return body.progressByChallengeId ?? {};
  }

  public async getAccelerators(mode = "accelerated", signal?: AbortSignal): Promise<AcceleratorResponse> {
    const body = await this.getJson(`/api/v1/settings/${encodeURIComponent(mode)}/accelerators`, false, signal) as {
      accelerators?: unknown;
      supportedLanguages?: unknown;
    };
    return {
      accelerators: Array.isArray(body.accelerators)
        ? body.accelerators.filter((value): value is string => typeof value === "string")
        : [],
      supportedLanguages: isLanguageMap(body.supportedLanguages) ? body.supportedLanguages : {}
    };
  }

  public async getSubmissions(challengeId: number, language: string, accelerator: string): Promise<unknown> {
    const query = new URLSearchParams({
      challengeId: String(challengeId),
      language,
      accelerator
    });
    return this.getJson(`/api/v1/submissions?${query.toString()}`, true);
  }

  public async getSubmissionCode(submissionId: string): Promise<unknown> {
    return this.getJson(`/api/v1/submissions/${encodeURIComponent(submissionId)}/code`, true);
  }

  public async getSolutions(
    challengeId: number,
    language: string,
    accelerator: string,
    page = 1,
    pageSize = 10
  ): Promise<unknown> {
    const query = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      language,
      accelerator
    });
    return this.getJson(
      `/api/v1/challenges/${challengeId}/solutions?${query.toString()}`,
      true
    );
  }

  public async getChallengeLeaderboard(
    challengeId: number,
    language: string,
    accelerator: string
  ): Promise<unknown> {
    const query = new URLSearchParams({ language, accelerator });
    return this.getJson(`/api/v1/challenges/${challengeId}/leaderboard?${query.toString()}`, true);
  }

  public async getGlobalLeaderboard(language: string): Promise<unknown> {
    return this.getJson(`/api/v1/submissions/leaderboard/${encodeURIComponent(language)}`, false);
  }

  public async generateAssembly(
    files: SubmissionFile[],
    accelerator: string,
    signal?: AbortSignal
  ): Promise<AssemblyResponse> {
    const body = {
      files,
      accelerator,
      language: "cuda"
    };
    let token = await this.auth.getAccessToken();
    let response: unknown;
    try {
      response = await postJson("/api/v1/assembly", body, signal, token);
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) throw error;
      token = await this.auth.getAccessToken(true);
      response = await postJson("/api/v1/assembly", body, signal, token);
    }
    return assemblyResponseSchema.parse(response);
  }

  public async getDisplayName(): Promise<string | undefined> {
    const body = await this.getJson("/api/v1/me/display-name", true) as { displayName?: unknown };
    return typeof body.displayName === "string" ? body.displayName : undefined;
  }

  public async hasActiveSubscription(signal?: AbortSignal): Promise<boolean> {
    const body = await this.getJson("/api/v1/me/billing/subscription-status", true, signal) as { active?: unknown };
    return body.active === true;
  }

  private async getJson(path: string, authenticated: boolean, signal?: AbortSignal): Promise<unknown> {
    throwIfAborted(signal);
    let token = authenticated ? await this.auth.getAccessToken() : undefined;
    throwIfAborted(signal);
    let response = await request(path, token, signal);
    if (authenticated && response.status === 401) {
      token = await this.auth.getAccessToken(true);
      throwIfAborted(signal);
      response = await request(path, token, signal);
    }
    if (!response.ok) {
      throw new ApiError(`LeetGPU request failed (${response.status}).`, response.status);
    }
    try {
      const body = await response.json();
      throwIfAborted(signal);
      return body;
    } catch {
      throwIfAborted(signal);
      throw new ApiError("LeetGPU returned invalid JSON.", response.status);
    }
  }
}

async function request(path: string, token?: string, externalSignal?: AbortSignal): Promise<Response> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    throwIfAborted(externalSignal);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    const abort = () => controller.abort(externalSignal?.reason);
    externalSignal?.addEventListener("abort", abort, { once: true });
    try {
      const response = await fetch(`${HTTP_API_URL}${path}`, { headers, signal: controller.signal });
      if ((response.status === 429 || response.status >= 500) && attempt < 2) {
        await delay(250 * 2 ** attempt, externalSignal);
        continue;
      }
      return response;
    } catch (error) {
      throwIfAborted(externalSignal);
      lastError = error;
      if (attempt < 2) {
        await delay(250 * 2 ** attempt, externalSignal);
        continue;
      }
    } finally {
      clearTimeout(timeout);
      externalSignal?.removeEventListener("abort", abort);
    }
  }
  throw new ApiError(lastError instanceof Error ? lastError.message : "LeetGPU request failed.");
}

async function postJson(
  path: string,
  body: unknown,
  externalSignal: AbortSignal | undefined,
  token: string
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  const abort = () => controller.abort();
  externalSignal?.addEventListener("abort", abort, { once: true });
  try {
    const response = await fetch(`${HTTP_API_URL}${path}`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    if (!response.ok) {
      let message = `LeetGPU request failed (${response.status}).`;
      try {
        const error = await response.json() as { error?: unknown; stderr?: unknown };
        const detail = typeof error.error === "string"
          ? error.error
          : typeof error.stderr === "string" ? error.stderr : undefined;
        if (detail) message = detail.slice(0, 8_000);
      } catch {
        // Keep the status-only error when the service does not return JSON.
      }
      throw new ApiError(message, response.status);
    }
    return await response.json();
  } catch (error) {
    if (externalSignal?.aborted) throw new ApiError("Assembly generation was canceled.");
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError("Assembly generation timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener("abort", abort);
  }
}

function isLanguageMap(value: unknown): value is Record<string, string[]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value).every(
    (entry) => Array.isArray(entry) && entry.every((item) => typeof item === "string")
  );
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  throwIfAborted(signal);
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, ms);
    const abort = () => {
      clearTimeout(timeout);
      reject(abortReason(signal));
    };
    signal?.addEventListener("abort", abort, { once: true });
  });
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortReason(signal);
}

function abortReason(signal?: AbortSignal): unknown {
  return signal?.reason ?? new DOMException("LeetGPU request was canceled.", "AbortError");
}
