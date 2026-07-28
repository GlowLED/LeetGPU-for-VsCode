# LeetGPU for VS Code (Unofficial)

Solve [LeetGPU](https://leetgpu.com/) challenges without leaving VS Code. The extension keeps solutions as ordinary workspace files and sends Run/Submit requests to LeetGPU's hosted execution service.

> This community project is not affiliated with, endorsed by, or maintained by AlphaGPU or LeetGPU. The integration currently depends on web-client APIs that may change without notice.

## Features

- Browse, search, and filter the live LeetGPU challenge list.
- Read sanitized problem statements beside a native VS Code editor.
- Create separate solution files for CUDA, Triton, PyTorch, JAX, CuTe DSL, and Mojo.
- Select a compatible accelerator and stream Run/Submit output into the LeetGPU Console.
- Cancel active runs, inspect submission history, and view challenge/global leaderboards.
- Work in local folders, WSL, Remote SSH, and Dev Containers.

Solutions are created under:

```text
leetgpu/<challenge-id>-<slug>/<language>/solution.*
```

Existing solution files are never overwritten unless you explicitly run **LeetGPU: Reset Solution to Latest Starter** and confirm the warning.

## Connect your account

LeetGPU currently exposes GitHub/Google browser login but no public device-code or VS Code OAuth callback. This beta therefore imports a dedicated Supabase refresh token.

1. Open a new **private/incognito browser window** and sign in at <https://leetgpu.com/>.
2. Open the browser Developer Tools.
3. In **Application** (Chrome/Edge) or **Storage** (Firefox), open Local Storage for `https://leetgpu.com`.
4. Find the key whose name starts with `sb-` and ends with `-auth-token`.
5. Copy only its `refresh_token` value. You may also copy the entire JSON value.
6. Close the private window **without clicking Sign Out**.
7. In VS Code, run **LeetGPU: Import Session** and paste the value into the masked input.
8. Accept **Clear Clipboard** after a successful import if the clipboard no longer needs the token.

Use a private window so the website and extension do not keep refreshing the same session. Supabase refresh tokens rotate; long-term sharing of one session between independent clients can invalidate that session.

Never paste a refresh token into source files, settings, chat, issues, screenshots, or logs. **LeetGPU: Disconnect** removes the encrypted session from VS Code without signing out other browser sessions.

## Usage

1. Open the LeetGPU Activity Bar view and select a challenge.
2. Choose a language in the problem panel. The native solution file opens beside it.
3. Select a GPU from the status bar or **LeetGPU: Select GPU**.
4. Use CodeLens, editor title buttons, `Ctrl/Cmd+'` to run, or `Ctrl/Cmd+Enter` to submit.
5. Inspect streaming output in the LeetGPU Console panel.

New submissions are private by default. Change `leetgpu.submissionVisibility` if you intentionally want public submissions.

## Settings

| Setting | Default | Meaning |
| --- | --- | --- |
| `leetgpu.solutionDirectory` | `leetgpu` | Workspace-relative solution root |
| `leetgpu.defaultAccelerator` | `T4` | Preferred accelerator when compatible |
| `leetgpu.submissionVisibility` | `private` | Visibility of new submissions |

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

This repository contains only extension code under the MIT License. It does not bundle, mirror, or ship LeetGPU challenges or starter templates. Those are fetched on demand from LeetGPU and remain subject to the [LeetGPU challenge repository license](https://github.com/AlphaGPU/leetgpu-challenges).

Before publishing this integration to the Marketplace, the maintainer should obtain confirmation from LeetGPU covering use of its undocumented web APIs, starter templates, and brand name. Until then, treat generated VSIX files as development builds.

See [PRIVACY.md](PRIVACY.md) and [SECURITY.md](SECURITY.md) before using or publishing the beta.
