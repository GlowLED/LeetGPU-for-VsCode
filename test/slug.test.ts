import { describe, expect, it } from "vitest";
import { slugify, solutionFileName, starterHash } from "../src/utils/slug";

describe("solution paths", () => {
  it("creates a stable safe slug", () => {
    expect(slugify("  Matrix–Vector Multiplication!  ")).toBe("matrix-vector-multiplication");
    expect(slugify("你好")).toBe("challenge");
  });

  it("maps known languages to native filenames", () => {
    expect(solutionFileName("cuda")).toBe("solution.cu");
    expect(solutionFileName("mojo")).toBe("solution.mojo");
    expect(solutionFileName("triton")).toBe("solution.py");
    expect(solutionFileName("future-language")).toBe("solution.txt");
  });

  it("hashes starter content deterministically", () => {
    expect(starterHash("same")).toBe(starterHash("same"));
    expect(starterHash("same")).not.toBe(starterHash("different"));
  });
});
