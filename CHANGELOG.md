# Changelog

## 0.2.0

- Added GitHub and Google browser sign-in using a VS Code callback and PKCE authorization-code exchange.
- Added one-click clipboard import for complete Supabase session JSON, without manually locating `refresh_token`.
- Kept manual token import as a fallback when LeetGPU has not allowlisted the VS Code OAuth callback.

## 0.1.4

- Render unavailable accelerators as visible picker entries with disabled styling and block their selection.

## 0.1.3

- Made the problem-panel accelerator label selectable and show the current accelerator in solution CodeLens.
- Kept all GPU and TPU devices visible while making language-incompatible devices unavailable.
- Applied LeetGPU subscription access to H100, H200, and B200 selection while keeping paid devices visible to free users.

## 0.1.2

- Made the offline `jax.Array` model permissive so unfinished JAX starters with `pass` do not report false missing-return errors.

## 0.1.1

- Added dependency-free CUDA, Triton, PyTorch, JAX, CuTe, and Mojo analysis models.
- Added scoped completion, hover, signature help, language-extension suggestions, and a language-support repair command.
- Skip unregistered third-party settings and never block challenge opening when an optional configuration update fails.

## 0.1.0

- Initial unofficial beta.
- Challenge browsing, native workspace solutions, multi-language templates, GPU selection, Run/Submit streaming, cancellation, submission history, and leaderboards.
- Encrypted refresh-token session import and local disconnect.
