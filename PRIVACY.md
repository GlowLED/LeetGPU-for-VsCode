# Privacy

This extension has no analytics or telemetry and does not operate an intermediary service.

It connects directly to:

- `https://api.leetgpu.com` and `wss://api.leetgpu.com` for challenges, account data, execution, submissions, and leaderboards.
- `https://yhdtysacdkqoquvkdwdd.supabase.co` for GitHub/Google browser authorization, imported-session exchange, and session refresh.

Run and Submit send the active solution code, challenge identifier, language, selected accelerator, visibility, user identifier, and generated submission identifier to LeetGPU. Read LeetGPU's own terms and privacy policy before use.

Invoking **View PTX / SASS** sends the current CUDA editor contents and selected accelerator to LeetGPU's assembly endpoint. This action is never automatic and the generated assembly is kept only in read-only in-memory editor documents.

The resulting session is stored using VS Code `SecretStorage`. Session values are never written to workspace files or extension logs. Automatic sign-in uses a persistent, extension-owned Chromium profile and a debugging endpoint bound to `127.0.0.1`. It reads and immediately removes only LeetGPU's session entry, then closes the browser. The dedicated profile remains in VS Code's extension global-storage area and may retain GitHub/Google sign-in cookies, cache, history, and other ordinary browser-profile data for later authorization; the extension does not inspect that retained data. It can be deleted with **LeetGPU: Reset Browser Sign-In Profile**.

Existing browser profiles, cookies, history, tabs, and local storage are never inspected. Clipboard contents are read only when the user explicitly invokes clipboard session import. The extension does not monitor clipboard changes, and it only offers to clear the clipboard when its contents still match the imported value. Account disconnection deletes the local session but does not revoke the corresponding server session.
