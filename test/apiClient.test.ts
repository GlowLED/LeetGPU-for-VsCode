import { afterEach, describe, expect, it, vi } from "vitest";
import { HTTP_API_URL } from "../src/constants";
import { LeetGpuClient } from "../src/services/apiClient";
import { AuthError, type AuthService } from "../src/services/authService";

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LeetGpuClient assembly authentication", () => {
  it("does not request assembly without a connected session", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const auth = {
      getAccessToken: vi.fn().mockRejectedValue(new AuthError("Not connected to LeetGPU.", 401))
    } as unknown as AuthService;

    await expect(new LeetGpuClient(auth).generateAssembly([], "T4"))
      .rejects.toThrow("Not connected to LeetGPU.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("authenticates assembly requests", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ ptx: ".version 8.7", sass: "EXIT ;" }));
    vi.stubGlobal("fetch", fetchMock);
    const auth = {
      getAccessToken: vi.fn().mockResolvedValue("access-token")
    } as unknown as AuthService;

    await expect(new LeetGpuClient(auth).generateAssembly([], "T4"))
      .resolves.toEqual({ ptx: ".version 8.7", sass: "EXIT ;" });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${HTTP_API_URL}/api/v1/assembly`);
    expect(init.headers).toMatchObject({ Authorization: "Bearer access-token" });
  });
});

describe("LeetGpuClient request cancellation", () => {
  it("aborts a superseded challenge request without retrying it", async () => {
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal;
      if (!signal) return;
      const abort = () => reject(signal.reason);
      if (signal.aborted) abort();
      else signal.addEventListener("abort", abort, { once: true });
    }));
    vi.stubGlobal("fetch", fetchMock);
    const auth = {} as AuthService;
    const controller = new AbortController();
    const reason = new Error("A newer challenge was selected.");
    const request = new LeetGpuClient(auth).getChallenge(1, controller.signal);
    const rejection = expect(request).rejects.toBe(reason);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());

    controller.abort(reason);

    await rejection;
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
