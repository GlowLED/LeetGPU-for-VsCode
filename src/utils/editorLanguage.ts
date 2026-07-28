export const CUDA_EDITOR_LANGUAGE_ID = "cuda-cpp";

export function editorLanguageIdForSolution(language: string): string | undefined {
  const normalized = language.toLowerCase();
  if (normalized === "cuda") return CUDA_EDITOR_LANGUAGE_ID;
  if (["triton", "pytorch", "jax", "cute"].includes(normalized)) return "python";
  if (normalized === "mojo") return "mojo";
  return undefined;
}

export function editorLanguageIdForFile(name: string): string {
  const normalized = name.toLowerCase();
  if (normalized.endsWith(".cu") || normalized.endsWith(".cuh")) return CUDA_EDITOR_LANGUAGE_ID;
  if (normalized.endsWith(".py")) return "python";
  if (normalized.endsWith(".mojo")) return "mojo";
  return "plaintext";
}

export function resolveAvailableEditorLanguage(
  preferred: string,
  availableLanguages: readonly string[]
): string {
  if (availableLanguages.includes(preferred)) return preferred;
  if (preferred === CUDA_EDITOR_LANGUAGE_ID && availableLanguages.includes("cpp")) return "cpp";
  if (preferred === "mojo" && availableLanguages.includes("python")) return "python";
  return "plaintext";
}
