# LeetGPU for VS Code (Unofficial)

Solve [LeetGPU](https://leetgpu.com/) challenges without leaving VS Code. The extension keeps solutions as ordinary workspace files and sends Run/Submit requests to LeetGPU's hosted execution service.

> This community project is not affiliated with, endorsed by, or maintained by AlphaGPU or LeetGPU. The integration currently depends on web-client APIs that may change without notice.

## 登录 LeetGPU（运行或提交前必读）

> **GitHub 和 Google 的直接浏览器回调目前不可用，因此插件暂时不会显示这两个登录选项。** 当前支持“复制完整会话 JSON”和“手动输入 token”两种方式。推荐使用第一种，不需要自己从 JSON 中查找 `refresh_token`。

### 方式一：复制完整会话 JSON（推荐）

1. 新建一个浏览器的**无痕/隐私窗口**，打开 [leetgpu.com](https://leetgpu.com/) 并使用自己的 GitHub 或 Google 帐号登录。
2. 登录成功后，停留在 LeetGPU 页面并打开开发者工具：
   - Chrome、Edge：按 `F12`，选择 **Application（应用）**。
   - Firefox：按 `F12`，选择 **Storage（存储）**。
3. 在左侧依次展开 **Local Storage（本地存储）** → `https://leetgpu.com`。
4. 找到名称以 `sb-` 开头、以 `-auth-token` 结尾的条目，例如 `sb-xxxxxxxx-auth-token`。
5. 右键该条目的 **Value（值）**，选择 **Copy value（复制值）**。应复制整个 JSON 值，不要复制 key，也不要手动截取其中的 token。
6. 直接关闭这个无痕/隐私窗口，**不要点击 LeetGPU 的 Sign Out**。点击 Sign Out 可能立即使刚复制的会话失效。
7. 回到 VS Code，执行以下任一操作：
   - 打开 LeetGPU 侧边栏，点击未登录的帐号项；或
   - 按 `Ctrl/Cmd+Shift+P` 打开命令面板，运行 **LeetGPU: Sign In**。
8. 选择 **Import copied browser session**。插件只会在此时读取一次剪贴板，并自动从完整 JSON 中提取 `refresh_token`。
9. 出现 `Connected as ...` 表示登录成功。建议点击 **Clear Clipboard**；只有当剪贴板仍然是刚才导入的 JSON 时，插件才会将其清空。

如果提示剪贴板中没有完整会话 JSON，请确认复制的是 `sb-…-auth-token` 条目的 **Value**，而不是条目名称、截图或开发者工具中被截断的预览文本。如果提示认证失败，请重新打开一个无痕窗口登录并复制最新值；不要复用已执行 Sign Out 的会话。

### 方式二：手动输入 token

1. 按照方式一的第 1–6 步取得 LeetGPU 会话。
2. 在 VS Code 中运行 **LeetGPU: Sign In**，选择 **Paste a refresh token manually**；也可以直接运行 **LeetGPU: Import Session Manually**。
3. 在密码输入框中粘贴以下任一种内容：
   - 单独的原始 `refresh_token`；或
   - 完整的 `sb-…-auth-token` JSON（插件同样会自动提取 token）。
4. 按 Enter 验证会话，看到 `Connected as ...` 后即完成登录。

插件会将会话保存在 VS Code 的加密 `SecretStorage` 中，不会写入工作区文件或日志。不要把会话 JSON 或 token 粘贴到源码、设置、聊天、Issue、截图或在线 JSON 工具中。**LeetGPU: Disconnect** 只会删除 VS Code 中保存的本地会话，不会让其他浏览器退出登录。

## Features

- Browse, search, and filter the live LeetGPU challenge list.
- Read sanitized problem statements beside a native VS Code editor.
- Create separate solution files for CUDA, Triton, PyTorch, JAX, CuTe DSL, and Mojo.
- Edit without installing CUDA, Torch, Triton, JAX, CuTe, or Mojo: generated analysis models remove dependency errors and provide common API completion, hover, and signature help.
- Select an accelerator from either the problem panel or solution CodeLens and stream Run/Submit output into the LeetGPU Console.
- Automatically open the bottom LeetGPU Console on Run/Submit and render ANSI-colored test output with the active VS Code terminal theme.
- Show notification progress while switching languages or loading accelerators, submissions, solutions, and leaderboards.
- Cancel active runs, inspect submission history and public solutions, and view challenge/global leaderboards.
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

## Usage

1. Open the LeetGPU Activity Bar view and select a challenge.
2. Choose a language in the problem panel. The native solution file opens beside it.
3. Select an accelerator from the problem panel, solution CodeLens, status bar, or **LeetGPU: Select Accelerator**. The picker keeps every GPU and TPU visible; devices that do not support the current language or account are shown as unavailable. JAX runs on TPU, while the other languages run on GPU. H100, H200, and B200 require an active LeetGPU Pro subscription.
4. Use CodeLens, editor title buttons, `Ctrl/Cmd+'` to run, or `Ctrl/Cmd+Enter` to submit.
5. Use the problem panel's **Submissions** tab to inspect your submitted code in a named, read-only preview editor. Closing these previews never asks you to save a file.
6. Use **Solutions** to browse paginated public solutions for the selected language and accelerator. **View Code** opens a read-only native editor with language-aware syntax highlighting. Streaming output remains available in the LeetGPU Console panel.

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
