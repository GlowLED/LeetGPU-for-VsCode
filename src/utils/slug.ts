import { createHash } from "node:crypto";

export function slugify(value: string): string {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return normalized || "challenge";
}

export function starterHash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function solutionFileName(language: string): string {
  switch (language.toLowerCase()) {
    case "cuda":
      return "solution.cu";
    case "mojo":
      return "solution.mojo";
    case "triton":
    case "pytorch":
    case "jax":
    case "cute":
      return "solution.py";
    default:
      return "solution.txt";
  }
}
