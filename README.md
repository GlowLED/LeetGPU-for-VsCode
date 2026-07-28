# LeetGPU for VS Code (Unofficial)

Solve [LeetGPU](https://leetgpu.com/) challenges without leaving VS Code. The extension keeps solutions as ordinary workspace files and sends Run/Submit requests to LeetGPU's hosted execution service.

> This community project is not affiliated with, endorsed by, or maintained by AlphaGPU or LeetGPU. The integration currently depends on web-client APIs that may change without notice.

## Features

- Browse, search, and filter the live LeetGPU challenge list.
- Read sanitized problem statements beside a native VS Code editor.
- Create separate solution files for CUDA, Triton, PyTorch, JAX, CuTe DSL, and Mojo.
- Edit without installing CUDA, Torch, Triton, JAX, CuTe, or Mojo: generated analysis models remove dependency errors and provide common API completion, hover, and signature help.
- Select an accelerator from either the problem panel or solution CodeLens and stream Run/Submit output into the LeetGPU Console.
- Cancel active runs, inspect submission history, and view challenge/global leaderboards.
- Work in local folders, WSL, Remote SSH, and Dev Containers.

Solutions are created under:

```text
leetgpu/<challenge-id>-<slug>/<language>/solution.*
```

Existing solution files are never overwritten unless you explicitly run **LeetGPU: Reset Solution to Latest Starter** and confirm the warning.

## Dependency-free language support

When the first solution in a workspace is opened, the extension creates a versioned cache under `leetgpu/.support/` (or the configured solution directory) and adds that cache to the relevant VS Code analysis paths. It contains minimal CUDA headers, Python type/source models, and Mojo compatibility imports based on the APIs used by LeetGPU starters. The cache is hidden from Explorer and Search and is never included in Run or Submit requests.

The built-in completion, hover, and signature help works without third-party language extensions. Microsoft C/C++, Python with Pylance, and the official Mojo extension are suggested once and enhance semantic editing when installed; they are not required or installed automatically. Use **LeetGPU: Rebuild Language Support** if the generated cache is removed or damaged.

The models intentionally cover common LeetGPU APIs rather than entire vendor SDKs. They suppress dependency-resolution noise while leaving genuine syntax and solution errors enabled. Explicit project-level `pyrightconfig.json`, `pyproject.toml`, or `c_cpp_properties.json` settings can override VS Code workspace analysis paths.

## Connect your account

Run **LeetGPU: Sign In** and choose one of these methods:

- **Continue with GitHub/Google** opens LeetGPU's Supabase OAuth flow in your browser. It uses an authorization code with PKCE and returns to VS Code without copying a token. LeetGPU must allow the generated VS Code callback in its Supabase redirect configuration; if it does not, use the clipboard method.
- **Import copied browser session** is the reliable fallback and does not require extracting a field from JSON.

For clipboard import:

1. Open a new **private/incognito browser window** and sign in at <https://leetgpu.com/>.
2. Open the browser Developer Tools.
3. In **Application** (Chrome/Edge) or **Storage** (Firefox), open Local Storage for `https://leetgpu.com`.
4. Find the key whose name starts with `sb-` and ends with `-auth-token`.
5. Right-click its value and choose **Copy value**. Do not expand or edit the JSON.
6. Close the private window **without clicking Sign Out**.
7. In VS Code, choose **Import copied browser session**; the extension reads the clipboard once and extracts `refresh_token` automatically.
8. Accept **Clear Clipboard** after a successful import if the clipboard no longer needs the token.

Use a private window so the website and extension do not keep refreshing the same session. Supabase refresh tokens rotate; long-term sharing of one session between independent clients can invalidate that session.

The clipboard is read only after you explicitly choose the import action. It is never monitored in the background. **LeetGPU: Import Session Manually** remains available for raw tokens or complete JSON.

Never paste a refresh token into source files, settings, chat, issues, screenshots, or logs. **LeetGPU: Disconnect** removes the encrypted session from VS Code without signing out other browser sessions.

## Usage

1. Open the LeetGPU Activity Bar view and select a challenge.
2. Choose a language in the problem panel. The native solution file opens beside it.
3. Select an accelerator from the problem panel, solution CodeLens, status bar, or **LeetGPU: Select Accelerator**. The picker keeps every GPU and TPU visible; devices that do not support the current language or account are shown as unavailable. JAX runs on TPU, while the other languages run on GPU. H100, H200, and B200 require an active LeetGPU Pro subscription.
4. Use CodeLens, editor title buttons, `Ctrl/Cmd+'` to run, or `Ctrl/Cmd+Enter` to submit.
5. Inspect streaming output in the LeetGPU Console panel.

New submissions are private by default. Change `leetgpu.submissionVisibility` if you intentionally want public submissions.

## Settings

| Setting | Default | Meaning |
| --- | --- | --- |
| `leetgpu.solutionDirectory` | `leetgpu` | Workspace-relative solution root |
| `leetgpu.defaultAccelerator` | `T4` | Preferred accelerator when compatible |
| `leetgpu.submissionVisibility` | `private` | Visibility of new submissions |
| `leetgpu.languageSupport.enabled` | `true` | Generate offline dependency models and provide editor assistance |
| `leetgpu.languageSupport.suggestExtensions` | `true` | Suggest compatible full language extensions once |

Service URLs are intentionally not configurable: redirecting them could leak account credentials or submitted source code.

## Development

```bash
npm install
npm run check
npm test
npm run build
```

Press `F5` in VS Code to launch an Extension Development Host. Production submission tests must use a dedicated test account and must not run in CI.

## Content and licensing

This repository contains extension code and clean-room, minimal analysis declarations under the MIT License. It does not bundle, mirror, or ship LeetGPU challenges, starter templates, or vendor SDK implementations. Challenges are fetched on demand from LeetGPU and remain subject to the [LeetGPU challenge repository license](https://github.com/AlphaGPU/leetgpu-challenges).

Before publishing this integration to the Marketplace, the maintainer should obtain confirmation from LeetGPU covering use of its undocumented web APIs, starter templates, and brand name. Until then, treat generated VSIX files as development builds.

See [PRIVACY.md](PRIVACY.md) and [SECURITY.md](SECURITY.md) before using or publishing the beta.
