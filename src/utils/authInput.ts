export function extractRefreshToken(input: string): string | undefined {
  const trimmed = input.trim();
  if (!trimmed) {
    return undefined;
  }
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return trimmed.replace(/^['"]|['"]$/g, "");
  }
  try {
    return findRefreshToken(JSON.parse(trimmed));
  } catch {
    return undefined;
  }
}

export function extractRefreshTokenFromJson(input: string): string | undefined {
  const trimmed = input.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return undefined;
  try {
    return findRefreshToken(JSON.parse(trimmed));
  } catch {
    return undefined;
  }
}

function findRefreshToken(value: unknown): string | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = findRefreshToken(entry);
      if (found) return found;
    }
    return undefined;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.refresh_token === "string") {
    return record.refresh_token;
  }
  for (const entry of Object.values(record)) {
    const found = findRefreshToken(entry);
    if (found) return found;
  }
  return undefined;
}
