import { describe, expect, it } from "vitest";
import { extractRefreshToken, extractRefreshTokenFromJson } from "../src/utils/authInput";

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

  it("requires structured JSON for clipboard imports", () => {
    expect(extractRefreshTokenFromJson(JSON.stringify({ session: { refresh_token: "clipboard-token" } })))
      .toBe("clipboard-token");
    expect(extractRefreshTokenFromJson("raw-token")).toBeUndefined();
    expect(extractRefreshTokenFromJson("{bad json")).toBeUndefined();
  });
});
