export function redactSecrets(message: string): string {
  return message
    .replace(/(refresh_token|access_token)\s*[:=]?\s*["']?[^\s,"'}]+/gi, "$1: [redacted]")
    .replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, "Bearer [redacted]");
}
