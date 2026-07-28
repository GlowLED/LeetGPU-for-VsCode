import { describe, expect, it } from "vitest";
import { extractRefreshToken } from "../src/utils/authInput";

describe("refresh token input", () => {
  it("accepts a raw token", () => {
    expect(extractRefreshToken("  token-value  ")).toBe("token-value");
  });

  it("extracts a token from nested Supabase session JSON", () => {
    expect(extractRefreshToken(JSON.stringify({ currentSession: { refresh_token: "nested-token" } })))
      .toBe("nested-token");
  });

  it("rejects empty and malformed JSON", () => {
    expect(extractRefreshToken("  ")).toBeUndefined();
    expect(extractRefreshToken("{bad json")).toBeUndefined();
    expect(extractRefreshToken("{}")) .toBeUndefined();
  });
});
