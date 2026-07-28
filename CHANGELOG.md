# Changelog

## 0.4.0

- Added PTX and NVIDIA SASS generation for the current CUDA solution and selected accelerator.
- Added CUDA-only problem-panel, CodeLens, editor-title, and command-palette assembly actions.
- Open PTX and SASS as named, read-only native editor tabs with bundled syntax highlighting.
- Added cancellable assembly compilation progress and compiler error reporting.

## 0.3.4

- Replace ambiguous loading-screen actions with an explicit challenge-list loading status.
- Show a retry action only after challenge loading fails, with the request error available as a tooltip.
- Move sign-in out of the loading state and clarify that it is optional for browsing but required for account actions.

## 0.3.3

- Open and focus the bottom LeetGPU Console automatically before preparing a Run or Submit request.
- Parse streaming ANSI SGR output into VS Code terminal theme colors instead of displaying raw escape characters.
- Preserve ANSI formatting across split WebSocket output chunks and strip unsupported terminal control sequences.

## 0.3.2

- Show VS Code notification progress while switching languages and fetching tab data.
- Show a loading notification while fetching accelerator availability and account access before opening the GPU picker.
- Show progress while fetching submitted source code.

## 0.3.1

- Open public Solutions code in a native read-only VS Code preview with language-aware syntax highlighting.
- Use Python highlighting as a visual fallback for Mojo when a Mojo language extension is unavailable.

## 0.3.0

- Added a paginated Solutions tab for browsing public code by language and accelerator.
- Open submission history in named, read-only virtual documents instead of dirty Untitled editors.
- Reuse VS Code's preview editor when inspecting submissions, so browsing history does not accumulate tabs.

## 0.2.0

- Added one-click clipboard import for complete Supabase session JSON, without manually locating `refresh_token`.
- Kept manual import for raw refresh tokens or complete session JSON.
- Disabled GitHub and Google browser callback options because LeetGPU currently rejects the extension callback URL.

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
