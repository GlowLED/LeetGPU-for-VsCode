export const HTTP_API_URL = "https://api.leetgpu.com";
export const WS_API_URL = "wss://api.leetgpu.com";
export const SUPABASE_URL = "https://yhdtysacdkqoquvkdwdd.supabase.co";

// Supabase publishable/anon keys are intentionally public client identifiers,
// not secrets. This is the same key shipped by leetgpu.com.
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InloZHR5c2FjZGtxb3F1dmtkd2RkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg2MzQ3MTksImV4cCI6MjA1NDIxMDcxOX0.aevKbBm0HgYbEI6CQ6UobY728lYwhi7dawnI3F_d0QM";

export const AUTH_SECRET_KEY = "leetgpu.auth.session.v1";
export const MANIFEST_FILE = ".leetgpu.json";
export const FINAL_SUBMISSION_STATUSES = new Set([
  "success",
  "test-case-failed",
  "timeout",
  "out-of-memory",
  "interrupted",
  "output-exceeded",
  "error"
]);

export const SUPPORTED_LANGUAGE_LABELS: Record<string, string> = {
  cuda: "CUDA",
  triton: "Triton",
  pytorch: "PyTorch",
  jax: "JAX",
  cute: "CuTe DSL",
  mojo: "Mojo"
};
