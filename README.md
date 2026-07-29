# LeetGPU for VS Code (Unofficial)

[English](#english) | [简体中文](#简体中文)

---

## English

### Overview

Solve [LeetGPU](https://leetgpu.com/) challenges without leaving VS Code. The extension keeps solutions as ordinary workspace files and sends Run/Submit requests directly to LeetGPU's hosted execution service.

> This community project is not affiliated with, endorsed by, or maintained by AlphaGPU or LeetGPU. It depends on web-client APIs that may change without notice.

### Sign in to LeetGPU — read before Run or Submit

Browsing challenges does not require an account. Signing in is required for Run, Submit, Submissions, account progress, and other account-specific operations.

The recommended sign-in path opens an isolated, extension-owned Chrome, Edge, Brave, or Chromium profile for GitHub or Google authorization. After LeetGPU signs in, the extension transfers the LeetGPU session to VS Code and closes the browser. The dedicated profile retains the provider's sign-in state, so later sign-ins usually do not require entering GitHub or Google credentials again. No JSON or token copying is required.

#### Browser sign-in (recommended)

1. Open the LeetGPU sidebar and click the signed-out account item, or run **LeetGPU: Sign In** from the command palette.
2. Select **Continue with GitHub** or **Continue with Google**, using the same provider as your LeetGPU account.
3. Complete authorization in the dedicated browser window. The first use has a separate profile, so GitHub or Google may ask you to sign in even if your regular browser is already signed in. Later uses reuse this dedicated profile.
4. When `Connected as ...` appears, sign-in is complete.

The dedicated browser exposes a debugging endpoint on `127.0.0.1` only. The extension reads and immediately removes only the `sb-…-auth-token` local-storage entry from `https://leetgpu.com`, then closes the process. GitHub/Google cookies and ordinary dedicated-profile data such as cache and history may remain for future authorization; LeetGPU's session is not retained there, and the extension does not inspect the other retained data. Canceling, timing out, failing, or starting a newer sign-in closes the window but preserves the profile. Existing browser profiles, cookies, history, and tabs are never opened or inspected. Run **LeetGPU: Reset Browser Sign-In Profile** to remove the dedicated profile and its saved provider sign-in state.

#### Fallback: import a browser session

Use this only if no supported Chromium browser is installed or automatic capture fails.

1. Open a new **Incognito/InPrivate/Private** browser window, visit [leetgpu.com](https://leetgpu.com/), and sign in with your GitHub or Google account.
2. Stay on the signed-in LeetGPU page and open Developer Tools:
   - Chrome or Edge: press `F12`, then select **Application**.
   - Firefox: press `F12`, then select **Storage**.
3. In the left sidebar, open **Local Storage** → `https://leetgpu.com`.
4. Find the entry whose name starts with `sb-` and ends with `-auth-token`, for example `sb-xxxxxxxx-auth-token`.
5. Right-click its **Value** and choose **Copy value**. Copy the complete JSON value—not the key, a screenshot, or a manually extracted token.
6. Close the private browser window directly. **Do not click Sign Out on LeetGPU.** Signing out can immediately invalidate the session you just copied.
7. In VS Code, run **LeetGPU: Sign In** and select **Import copied browser session**. The extension reads the clipboard once and extracts `refresh_token` from the complete JSON.
8. When `Connected as ...` appears, select **Clear Clipboard** to remove the copied JSON; it is cleared only if the clipboard still contains the exact imported value.

If VS Code reports that the clipboard does not contain a complete session JSON, verify that you copied the **Value** of the `sb-…-auth-token` entry rather than its name or a truncated Developer Tools preview. If authentication fails, create a fresh private window, sign in again, and copy the newest value. Do not reuse a session after clicking Sign Out.

#### Advanced fallback: paste a token manually

1. Follow steps 1–6 from the browser-session fallback to obtain the LeetGPU session.
2. Run **LeetGPU: Sign In** and select **Paste a refresh token manually**. You can also run **LeetGPU: Import Session Manually** directly.
3. Paste either of the following into the password input:
   - The raw `refresh_token`; or
   - The complete `sb-…-auth-token` JSON. The extension extracts the token automatically.
4. Press Enter. Sign-in is complete when `Connected as ...` appears.

#### Session security and disconnecting

The resulting session is stored in VS Code's encrypted `SecretStorage`; it is not written to workspace files or extension logs. Automatic sign-in reads only LeetGPU local storage in the extension-owned dedicated profile, never an existing browser profile. The dedicated profile persists separately in VS Code's extension global-storage area and may contain provider cookies protected by the browser and operating system. Clipboard contents are read only when you explicitly choose clipboard import, and the extension does not monitor clipboard changes.

Never paste a session JSON or token into source files, settings, chat messages, public issues, screenshots, or online JSON tools. **LeetGPU: Disconnect** deletes only the session stored by this VS Code extension; it does not sign other browsers out or revoke the server-side session.

### Features

- Browse, search, and filter the live LeetGPU challenge list without signing in.
- Read sanitized, math-rendered problem statements and inline diagrams beside a native VS Code editor.
- Create separate solution files for CUDA, Triton, PyTorch, JAX, CuTe DSL, and Mojo.
- Identify every generated solution with a comment header containing its challenge number, title, and language.
- Edit without installing CUDA, Torch, Triton, JAX, CuTe, or Mojo: generated analysis models suppress missing-dependency diagnostics and provide common completion, hover, and signature help.
- Select accelerators from the problem panel, solution CodeLens, status bar, or command palette while keeping unavailable GPUs and TPUs visible.
- Stream Run/Submit output into the LeetGPU Console with ANSI colors and cancellation support.
- Generate PTX and NVIDIA SASS for the current CUDA code and selected accelerator, then inspect both in syntax-highlighted read-only editors.
- Inspect submission history, public solutions, and challenge/global leaderboards.
- Work in local folders, WSL, Remote SSH, and Dev Containers.

Solutions are created under:

```text
leetgpu/<challenge-id>-<slug>/<language>/solution.*
```

Existing solution code is never overwritten unless you explicitly run **LeetGPU: Reset Solution to Latest Starter** and confirm the warning. Solutions created by an older extension version receive only the identifying comment header the next time they are opened.

Run and Submit resolve the solution from the open challenge and selected language. The problem panel therefore remains independent from editor focus: other files can stay open or active, and unsaved changes in the matching solution buffer are still used.

### Usage

1. Open the LeetGPU Activity Bar view and select a challenge.
   If you select another challenge while one is loading, the previous load is canceled; only the most recently selected challenge opens.
2. Choose a language in the problem panel. The native solution file opens beside it.
3. Select an accelerator from the problem panel, solution CodeLens, status bar, or **LeetGPU: Select Accelerator**. The picker keeps every GPU and TPU visible; devices unavailable to the selected language or account remain visible but disabled. JAX runs on TPU, while the other languages run on GPU. H100, H200, and B200 require an active LeetGPU Pro subscription.
4. Use CodeLens, editor title buttons, `Ctrl/Cmd+'` to run, or `Ctrl/Cmd+Enter` to submit. The bottom LeetGPU Console opens automatically.
5. Use **Submissions** to inspect submitted code in named, read-only preview editors. Closing these previews never asks you to save a file.
6. Use **Solutions** to browse paginated public solutions for the selected language and accelerator. **View Code** opens a read-only editor with language-aware syntax highlighting.
7. For CUDA, use **PTX / SASS** in the problem panel or CodeLens, the editor-title code icon, or **LeetGPU: View PTX / SASS**. Compilation uses the current editor contents, including unsaved changes.

New submissions are private by default. Change `leetgpu.submissionVisibility` only if you intentionally want public submissions.

### Dependency-free language support

When the first solution in a workspace is opened, the extension creates a versioned cache under `leetgpu/.support/` (or the configured solution directory) and adds it to the relevant VS Code analysis paths. The cache contains minimal CUDA headers, Python type/source models, and Mojo compatibility imports based on APIs used by LeetGPU starters. It is hidden from Explorer and Search and is never included in Run or Submit requests.

Built-in completion, hover, and signature help work without third-party language extensions. Microsoft C/C++, Python with Pylance, and the official Mojo extension are suggested once and can provide richer semantic editing, but they are neither required nor installed automatically. Run **LeetGPU: Rebuild Language Support** if the generated cache is removed or damaged.

These models cover common LeetGPU APIs rather than complete vendor SDKs. They suppress dependency-resolution noise while leaving genuine syntax and solution errors enabled. Project-level `pyrightconfig.json`, `pyproject.toml`, or `c_cpp_properties.json` settings can override the workspace analysis paths.

### Settings

| Setting | Default | Meaning |
| --- | --- | --- |
| `leetgpu.solutionDirectory` | `leetgpu` | Workspace-relative solution root |
| `leetgpu.defaultAccelerator` | `T4` | Preferred accelerator when compatible |
| `leetgpu.submissionVisibility` | `private` | Visibility of new submissions |
| `leetgpu.languageSupport.enabled` | `true` | Generate dependency-free analysis models and provide editor assistance |
| `leetgpu.languageSupport.suggestExtensions` | `true` | Suggest compatible full language extensions once |

Service URLs are intentionally not configurable. Redirecting them could leak account credentials or submitted source code.

### Development

```bash
npm install
npm run check
npm run lint
npm test
npm run build
```

Press `F5` in VS Code to launch an Extension Development Host. Production submission tests must use a dedicated test account and must not run in CI.

### Content, privacy, and licensing

This repository contains extension code and clean-room, minimal analysis declarations under the MIT License. It does not bundle, mirror, or ship LeetGPU challenges, starter templates, or vendor SDK implementations. Challenges are fetched on demand from LeetGPU and remain subject to the [LeetGPU challenge repository license](https://github.com/AlphaGPU/leetgpu-challenges).

Before publishing this integration to the Marketplace, the maintainer should obtain confirmation from LeetGPU covering use of its undocumented web APIs, starter templates, brand name, and logo. Until then, treat generated VSIX files as development builds.

Read [PRIVACY.md](PRIVACY.md) and [SECURITY.md](SECURITY.md) before using or publishing the extension.

---

## 简体中文

### 概览

无需离开 VS Code 即可完成 [LeetGPU](https://leetgpu.com/) 题目。插件将 solution 保存为普通工作区文件，并把 Run/Submit 请求直接发送到 LeetGPU 托管的执行服务。

> 这是一个社区项目，与 AlphaGPU 或 LeetGPU 没有关联，也未得到其认可或维护。当前集成依赖可能随时变化的 Web 客户端 API。

### 登录 LeetGPU——运行或提交前必读

浏览题目不需要帐号。Run、Submit、Submissions、帐号进度以及其他帐号相关操作需要登录。

推荐使用扩展启动的隔离、专属 Chrome、Edge、Brave 或 Chromium profile 完成 GitHub/Google 授权。LeetGPU 登录成功后，扩展会把 LeetGPU 会话转移到 VS Code 并关闭窗口。专属 profile 会保留登录提供商的状态，所以下次通常无需再次输入 GitHub 或 Google 凭据；全程无需复制 JSON 或 token。

#### 浏览器登录（推荐）

1. 打开 LeetGPU 侧边栏并点击未登录的帐号项，或从命令面板运行 **LeetGPU: Sign In**。
2. 选择 **Continue with GitHub** 或 **Continue with Google**，使用与 LeetGPU 帐号相同的登录提供商。
3. 在专属浏览器窗口中完成授权。首次使用的是独立 profile，因此即使普通浏览器已经登录 GitHub/Google，这里仍可能要求登录；后续会复用该专属 profile。
4. 出现 `Connected as ...` 后即登录成功。

专属浏览器只在 `127.0.0.1` 暴露调试端点。扩展只读取并立即删除 `https://leetgpu.com` 下的 `sb-…-auth-token` 本地存储项，随后关闭进程；GitHub/Google Cookie 以及缓存、历史记录等普通专属 profile 数据可能会保留以便后续授权，LeetGPU 会话不会留在其中，扩展也不会检查其他保留数据。取消、超时、失败或开始新的登录会关闭窗口但保留 profile。已有浏览器的 profile、Cookie、历史记录和标签页不会被打开或检查。运行 **LeetGPU: Reset Browser Sign-In Profile** 可删除专属 profile 及其中保存的提供商登录状态。

#### 兜底：导入浏览器会话

只有在没有安装受支持的 Chromium 浏览器或自动读取失败时才需要使用此方式。

1. 新建一个浏览器的**无痕/InPrivate/隐私**窗口，打开 [leetgpu.com](https://leetgpu.com/)，并使用自己的 GitHub 或 Google 帐号登录。
2. 登录成功后停留在 LeetGPU 页面，然后打开开发者工具：
   - Chrome 或 Edge：按 `F12`，选择 **Application（应用）**。
   - Firefox：按 `F12`，选择 **Storage（存储）**。
3. 在左侧依次展开 **Local Storage（本地存储）** → `https://leetgpu.com`。
4. 找到名称以 `sb-` 开头、以 `-auth-token` 结尾的条目，例如 `sb-xxxxxxxx-auth-token`。
5. 右键该条目的 **Value（值）**，选择 **Copy value（复制值）**。复制完整 JSON 值，不要复制 key、截图或手动截取出来的 token。
6. 直接关闭隐私浏览器窗口。**不要点击 LeetGPU 的 Sign Out。** 退出登录可能立即使刚复制的会话失效。
7. 在 VS Code 中运行 **LeetGPU: Sign In**，选择 **Import copied browser session**。插件只会读取一次剪贴板，并从完整 JSON 中提取 `refresh_token`。
8. 出现 `Connected as ...` 后选择 **Clear Clipboard**；只有当剪贴板仍包含刚导入的完整值时才会清空。

如果 VS Code 提示剪贴板中没有完整会话 JSON，请确认复制的是 `sb-…-auth-token` 条目的 **Value（值）**，而不是条目名称或开发者工具中被截断的预览。如果认证失败，请重新创建隐私窗口、再次登录并复制最新值。不要复用已经点击过 Sign Out 的会话。

#### 高级兜底：手动粘贴 token

1. 按照浏览器会话兜底方式的第 1–6 步取得 LeetGPU 会话。
2. 运行 **LeetGPU: Sign In**，选择 **Paste a refresh token manually**；也可以直接运行 **LeetGPU: Import Session Manually**。
3. 在密码输入框中粘贴以下任一种内容：
   - 原始 `refresh_token`；或
   - 完整的 `sb-…-auth-token` JSON。插件会自动提取 token。
4. 按 Enter。出现 `Connected as ...` 后即登录成功。

#### 会话安全与断开连接

最终会话保存在 VS Code 加密的 `SecretStorage` 中，不会写入工作区文件或扩展日志。自动登录只读取扩展专属 profile 中的 LeetGPU 本地存储，不会读取已有浏览器 profile。专属 profile 单独保存在 VS Code 的扩展全局存储区，可能包含由浏览器和操作系统保护的登录提供商 Cookie。只有当你明确选择从剪贴板导入时，插件才会读取剪贴板；插件不会监控剪贴板变化。

不要把会话 JSON 或 token 粘贴到源文件、设置、聊天消息、公开 Issue、截图或在线 JSON 工具中。**LeetGPU: Disconnect** 只会删除此 VS Code 插件保存的会话，不会让其他浏览器退出登录，也不会撤销服务端会话。

### 功能

- 无需登录即可浏览、搜索和筛选实时 LeetGPU 题目列表。
- 在原生 VS Code 编辑器旁阅读经过安全清理、支持数学公式和内嵌图形的题目描述。
- 为 CUDA、Triton、PyTorch、JAX、CuTe DSL 和 Mojo 分别创建 solution 文件。
- 在每个生成的 solution 文件头部用注释标明题号、题目名称和语言，便于同时编辑多个文件时辨认。
- 无需安装 CUDA、Torch、Triton、JAX、CuTe 或 Mojo 即可编辑：生成的分析模型会抑制缺少依赖的诊断，并提供常用补全、悬停和签名帮助。
- 可以从题目面板、solution CodeLens、状态栏或命令面板选择加速器，同时保留不可用 GPU 和 TPU 的可见状态。
- 将 Run/Submit 输出流式显示在 LeetGPU Console 中，并支持 ANSI 彩色文本和取消操作。
- 为当前 CUDA 代码和所选加速器生成 PTX 与 NVIDIA SASS，并在带语法高亮的只读编辑器中查看。
- 查看提交历史、公开 solutions，以及题目/全局排行榜。
- 支持本地文件夹、WSL、Remote SSH 和 Dev Containers。

Solution 会创建在：

```text
leetgpu/<challenge-id>-<slug>/<language>/solution.*
```

除非你明确运行 **LeetGPU: Reset Solution to Latest Starter** 并确认警告，否则插件不会覆盖已有 solution 代码。旧版插件创建的 solution 在下次打开时只会补充识别用的注释头。

Run 和 Submit 会根据当前题目与所选语言解析对应的 solution。题目面板不再依赖右侧编辑器焦点：即使其他文件处于活动状态，也会使用匹配 solution 缓冲区中的最新内容（包括尚未保存的修改）。

### 使用方法

1. 打开 LeetGPU Activity Bar 视图并选择一道题目。
   如果在加载期间选择了另一道题，前一次加载会被取消，最终只打开最后选择的题目。
2. 在题目面板中选择语言，原生 solution 文件会在旁边打开。
3. 从题目面板、solution CodeLens、状态栏或 **LeetGPU: Select Accelerator** 选择加速器。选择器会显示所有 GPU 和 TPU；对当前语言或帐号不可用的设备仍然可见，但无法选择。JAX 在 TPU 上运行，其他语言在 GPU 上运行。H100、H200 和 B200 需要有效的 LeetGPU Pro 订阅。
4. 使用 CodeLens、编辑器标题按钮或 `Ctrl/Cmd+'` 运行，使用 `Ctrl/Cmd+Enter` 提交。底部 LeetGPU Console 会自动打开。
5. 使用 **Submissions** 在有名称的只读预览编辑器中查看已提交代码。关闭这些预览不会要求保存文件。
6. 使用 **Solutions** 按所选语言和加速器分页浏览公开 solutions。**View Code** 会打开一个带语言语法高亮的只读编辑器。
7. 对于 CUDA，可以使用题目面板或 CodeLens 中的 **PTX / SASS**、编辑器标题栏的代码图标，或者 **LeetGPU: View PTX / SASS**。编译会使用当前编辑器内容，包括未保存的修改。

新提交默认是私有的。只有当你确实希望公开提交时，才修改 `leetgpu.submissionVisibility`。

### 无依赖语言支持

首次在工作区中打开 solution 时，插件会在 `leetgpu/.support/`（或配置的 solution 目录）下创建带版本的缓存，并将其加入相应的 VS Code 分析路径。缓存包含最小 CUDA 头文件、Python 类型/源码模型以及基于 LeetGPU starter 所用 API 的 Mojo 兼容导入。该缓存会从 Explorer 和 Search 中隐藏，也永远不会包含在 Run 或 Submit 请求中。

内置补全、悬停和签名帮助无需第三方语言扩展即可工作。插件会一次性建议 Microsoft C/C++、搭配 Pylance 的 Python 以及官方 Mojo 扩展；它们可以提供更丰富的语义编辑能力，但不是必需项，也不会被自动安装。如果生成的缓存被删除或损坏，请运行 **LeetGPU: Rebuild Language Support**。

这些模型只覆盖常用 LeetGPU API，而不是完整的厂商 SDK。它们会抑制依赖解析噪声，同时保留真正的语法错误和 solution 错误。项目级 `pyrightconfig.json`、`pyproject.toml` 或 `c_cpp_properties.json` 设置可能覆盖工作区分析路径。

### 设置

| 设置 | 默认值 | 含义 |
| --- | --- | --- |
| `leetgpu.solutionDirectory` | `leetgpu` | 相对于工作区的 solution 根目录 |
| `leetgpu.defaultAccelerator` | `T4` | 兼容时优先使用的加速器 |
| `leetgpu.submissionVisibility` | `private` | 新提交的可见性 |
| `leetgpu.languageSupport.enabled` | `true` | 生成无依赖分析模型并提供编辑器辅助 |
| `leetgpu.languageSupport.suggestExtensions` | `true` | 一次性建议兼容的完整语言扩展 |

服务 URL 被有意设为不可配置。将请求重定向到其他地址可能泄露帐号凭据或提交的源代码。

### 开发

```bash
npm install
npm run check
npm run lint
npm test
npm run build
```

在 VS Code 中按 `F5` 启动 Extension Development Host。生产环境提交测试必须使用专用测试帐号，并且不得在 CI 中运行。

### 内容、隐私与许可证

本仓库包含采用 MIT License 的扩展代码，以及通过 clean-room 方式编写的最小分析声明。仓库不会打包、镜像或分发 LeetGPU 题目、starter 模板或厂商 SDK 实现。题目会按需从 LeetGPU 获取，并继续受 [LeetGPU 题目仓库许可证](https://github.com/AlphaGPU/leetgpu-challenges)约束。

将此集成发布到 Marketplace 之前，维护者应取得 LeetGPU 对使用其未文档化 Web API、starter 模板、品牌名称和 Logo 的确认。在此之前，应将生成的 VSIX 文件视为开发版本。

使用或发布扩展前，请阅读 [PRIVACY.md](PRIVACY.md) 和 [SECURITY.md](SECURITY.md)。
