import { describe, expect, it } from "vitest";
import {
  CUDA_EDITOR_LANGUAGE_ID,
  editorLanguageIdForFile,
  editorLanguageIdForSolution,
  resolveAvailableEditorLanguage
} from "../src/utils/editorLanguage";

describe("editor language selection", () => {
  it("uses VS Code's CUDA C++ mode for CUDA solutions", () => {
    expect(editorLanguageIdForSolution("cuda")).toBe(CUDA_EDITOR_LANGUAGE_ID);
    expect(editorLanguageIdForFile("solution.cu")).toBe(CUDA_EDITOR_LANGUAGE_ID);
    expect(editorLanguageIdForFile("SOLUTION.CU")).toBe(CUDA_EDITOR_LANGUAGE_ID);
    expect(editorLanguageIdForFile("helpers.cuh")).toBe(CUDA_EDITOR_LANGUAGE_ID);
    expect(editorLanguageIdForSolution("CUDA")).toBe(CUDA_EDITOR_LANGUAGE_ID);
  });

  it("maps the remaining solution file types", () => {
    expect(editorLanguageIdForSolution("triton")).toBe("python");
    expect(editorLanguageIdForSolution("pytorch")).toBe("python");
    expect(editorLanguageIdForSolution("jax")).toBe("python");
    expect(editorLanguageIdForSolution("cute")).toBe("python");
    expect(editorLanguageIdForSolution("mojo")).toBe("mojo");
    expect(editorLanguageIdForSolution("unknown")).toBeUndefined();
    expect(editorLanguageIdForFile("solution.py")).toBe("python");
    expect(editorLanguageIdForFile("solution.mojo")).toBe("mojo");
    expect(editorLanguageIdForFile("solution.txt")).toBe("plaintext");
  });

  it("falls back to a highlighted compatible dialect when an optional language is unavailable", () => {
    expect(resolveAvailableEditorLanguage(CUDA_EDITOR_LANGUAGE_ID, ["plaintext", "cpp"]))
      .toBe("cpp");
    expect(resolveAvailableEditorLanguage(CUDA_EDITOR_LANGUAGE_ID, ["plaintext", "cpp", CUDA_EDITOR_LANGUAGE_ID]))
      .toBe(CUDA_EDITOR_LANGUAGE_ID);
    expect(resolveAvailableEditorLanguage("mojo", ["plaintext", "python"]))
      .toBe("python");
    expect(resolveAvailableEditorLanguage("unknown", ["plaintext"]))
      .toBe("plaintext");
  });
});
