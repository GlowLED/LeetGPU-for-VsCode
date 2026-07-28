import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "node_modules", "coverage", "media/katex"] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["*.mjs"],
    languageOptions: { globals: { process: "readonly" } }
  },
  {
    files: ["media/*.js"],
    languageOptions: {
      globals: {
        acquireVsCodeApi: "readonly",
        document: "readonly",
        window: "readonly",
        setTimeout: "readonly"
      }
    }
  },
  {
    files: ["**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off"
    }
  }
);
