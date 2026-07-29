import { SUPPORTED_LANGUAGE_LABELS } from "../constants";

const SOLUTION_MARKER = "LeetGPU Solution";

export function withSolutionIdentity(
  content: string,
  challenge: { id: number; title: string },
  language: string
): string {
  if (hasSolutionIdentity(content)) return content;
  const bom = content.startsWith("\uFEFF") ? "\uFEFF" : "";
  const body = bom ? content.slice(1) : content;
  const comment = language.toLowerCase() === "cuda" ? "//" : "#";
  const normalizedLanguage = normalizeMetadata(language).toLowerCase();
  const label = SUPPORTED_LANGUAGE_LABELS[normalizedLanguage] ?? normalizeMetadata(language);
  const header = [
    `${comment} ${SOLUTION_MARKER}`,
    `${comment} Challenge: #${challenge.id} · ${normalizeMetadata(challenge.title)}`,
    `${comment} Language: ${label} (${normalizedLanguage})`
  ].join("\n");

  return `${bom}${header}\n\n${body}`;
}

export function hasSolutionIdentity(content: string): boolean {
  const body = content.startsWith("\uFEFF") ? content.slice(1) : content;
  return /^(?:\/\/|#) LeetGPU Solution(?:\r?\n|$)/.test(body);
}

function normalizeMetadata(value: string): string {
  return value.replace(/[\r\n\u2028\u2029]+/g, " ").replace(/\s+/g, " ").trim();
}
