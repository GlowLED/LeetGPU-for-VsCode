export interface AcceleratorOption {
  name: string;
  compatible: boolean;
  supportedLanguages: string[];
  unavailableReason?: string;
}

export function acceleratorOptions(
  accelerators: string[],
  supportedLanguages: Record<string, string[]>,
  language: string,
  hasPaidAccess = false
): AcceleratorOption[] {
  const normalizedLanguage = language.toLowerCase();
  return accelerators.map((name) => {
    const languages = supportedLanguages[name] ?? [];
    const supportedByService = languages.length === 0
      || languages.some((value) => value.toLowerCase() === normalizedLanguage);
    const isTpu = /\btpu\b/i.test(name);
    const supportedDeviceKind = normalizedLanguage === "jax" ? isTpu : !isTpu;
    const requiresPaidAccess = /\b(?:h100|h200|b200)\b/i.test(name);
    const unavailableReason = !supportedDeviceKind
      ? normalizedLanguage === "jax" ? "JAX runs on TPU" : `${language} runs on GPU`
      : !supportedByService ? `Does not support ${language}`
      : requiresPaidAccess && !hasPaidAccess ? "Requires LeetGPU Pro"
      : undefined;
    return {
      name,
      compatible: unavailableReason === undefined,
      supportedLanguages: languages,
      unavailableReason
    };
  });
}

export function compatibleGpus(
  accelerators: string[],
  supportedLanguages: Record<string, string[]>,
  language: string,
  hasPaidAccess = false
): string[] {
  return acceleratorOptions(accelerators, supportedLanguages, language, hasPaidAccess)
    .filter((option) => option.compatible)
    .map((option) => option.name);
}
