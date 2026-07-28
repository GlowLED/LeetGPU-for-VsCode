export function compatibleGpus(
  accelerators: string[],
  supportedLanguages: Record<string, string[]>,
  language: string
): string[] {
  const normalizedLanguage = language.toLowerCase();
  return accelerators.filter((gpu) => {
    const languages = supportedLanguages[gpu];
    return !languages || languages.map((value) => value.toLowerCase()).includes(normalizedLanguage);
  });
}
