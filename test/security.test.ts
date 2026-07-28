import { describe, expect, it } from "vitest";
import { compatibleGpus } from "../src/utils/accelerators";
import { redactSecrets } from "../src/utils/redact";

describe("service safety helpers", () => {
  it("filters accelerators by language", () => {
    expect(compatibleGpus(["T4", "TPU v5e"], { T4: ["cuda", "jax"], "TPU v5e": ["jax"] }, "cuda"))
      .toEqual(["T4"]);
    expect(compatibleGpus(["T4"], {}, "future")).toEqual(["T4"]);
  });

  it("redacts bearer and session tokens", () => {
    const message = redactSecrets("refresh_token=secret access_token:abc Bearer eyJ.secret.value");
    expect(message).not.toContain("secret");
    expect(message).not.toContain("abc");
    expect(message).toContain("[redacted]");
  });
});
