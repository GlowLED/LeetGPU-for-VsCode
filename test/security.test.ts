import { describe, expect, it } from "vitest";
import { acceleratorOptions, compatibleGpus } from "../src/utils/accelerators";
import { redactSecrets } from "../src/utils/redact";

describe("service safety helpers", () => {
  it("filters accelerators by language", () => {
    expect(compatibleGpus(["T4", "TPU v5e"], { T4: ["cuda", "jax"], "TPU v5e": ["jax"] }, "cuda", true))
      .toEqual(["T4"]);
    expect(compatibleGpus(["T4"], {}, "future")).toEqual(["T4"]);
  });

  it("shows every accelerator while enforcing the JAX/TPU device boundary", () => {
    const support = { T4: ["cuda", "jax"], H100: ["cuda", "triton", "jax"], "TPU v5e": ["jax"] };
    expect(acceleratorOptions(["T4", "H100", "TPU v5e"], support, "cuda", true))
      .toMatchObject([
        { name: "T4", compatible: true },
        { name: "H100", compatible: true },
        { name: "TPU v5e", compatible: false }
      ]);
    expect(acceleratorOptions(["T4", "H100", "TPU v5e"], support, "jax", true))
      .toMatchObject([
        { name: "T4", compatible: false },
        { name: "H100", compatible: false },
        { name: "TPU v5e", compatible: true }
      ]);
  });

  it("keeps paid GPUs visible but unavailable to free accounts", () => {
    expect(acceleratorOptions(["T4", "H100", "H200", "B200"], {}, "triton"))
      .toMatchObject([
        { name: "T4", compatible: true },
        { name: "H100", compatible: false, unavailableReason: "Requires LeetGPU Pro" },
        { name: "H200", compatible: false, unavailableReason: "Requires LeetGPU Pro" },
        { name: "B200", compatible: false, unavailableReason: "Requires LeetGPU Pro" }
      ]);
  });

  it("redacts bearer and session tokens", () => {
    const message = redactSecrets("refresh_token=secret access_token:abc Bearer eyJ.secret.value");
    expect(message).not.toContain("secret");
    expect(message).not.toContain("abc");
    expect(message).toContain("[redacted]");
  });
});
