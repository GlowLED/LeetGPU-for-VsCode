# Privacy

This extension has no analytics or telemetry and does not operate an intermediary service.

It connects directly to:

- `https://api.leetgpu.com` and `wss://api.leetgpu.com` for challenges, account data, execution, submissions, and leaderboards.
- `https://yhdtysacdkqoquvkdwdd.supabase.co` for GitHub/Google browser authorization, authorization-code or imported-session exchange, and session refresh.

Run and Submit send the active solution code, challenge identifier, language, selected accelerator, visibility, user identifier, and generated submission identifier to LeetGPU. Read LeetGPU's own terms and privacy policy before use.

Browser sign-in uses PKCE and a short-lived random state value. Pending verifier data and the resulting session are stored using VS Code `SecretStorage`; completed or canceled pending data is deleted. Session values are never written to workspace files or extension logs.

Clipboard contents are read only when the user explicitly invokes clipboard session import. The extension does not monitor clipboard changes, and it only offers to clear the clipboard when its contents still match the imported value. Account disconnection deletes the local session but does not revoke the corresponding server session.
