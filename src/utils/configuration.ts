export function addUnique<T>(values: readonly T[] | undefined, additions: readonly T[]): T[] {
  return [...new Set([...(values ?? []), ...additions])];
}

export function removeValues<T>(values: readonly T[] | undefined, removals: readonly T[]): T[] {
  const removed = new Set(removals);
  return (values ?? []).filter((value) => !removed.has(value));
}

export function withBooleanEntry(
  values: Readonly<Record<string, boolean>> | undefined,
  key: string,
  enabled: boolean
): Record<string, boolean> {
  return { ...(values ?? {}), [key]: enabled };
}
