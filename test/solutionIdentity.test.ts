import { describe, expect, it } from "vitest";
import { withSolutionIdentity } from "../src/utils/solutionIdentity";

describe("solution identity", () => {
  it("adds CUDA-compatible challenge and language comments", () => {
    expect(withSolutionIdentity("extern \"C\" {}\n", { id: 42, title: "Vector Add" }, "cuda"))
      .toBe([
        "// LeetGPU Solution",
        "// Challenge: #42 · Vector Add",
        "// Language: CUDA (cuda)",
        "",
        "extern \"C\" {}",
        ""
      ].join("\n"));
  });

  it("uses Python comments and keeps a byte-order mark first", () => {
    const result = withSolutionIdentity("\uFEFFdef solve():\n    pass\n", { id: 7, title: "  Matrix\nScale  " }, "triton");
    expect(result.startsWith("\uFEFF# LeetGPU Solution\n")).toBe(true);
    expect(result).toContain("# Challenge: #7 · Matrix Scale\n");
    expect(result).toContain("# Language: Triton (triton)\n");
    expect(result.endsWith("def solve():\n    pass\n")).toBe(true);
  });

  it("does not duplicate an existing identity header", () => {
    const identified = withSolutionIdentity("fn main() {}\n", { id: 9, title: "First" }, "mojo");
    expect(withSolutionIdentity(identified, { id: 9, title: "First" }, "mojo")).toBe(identified);
  });
});
