# Privacy

This extension has no analytics or telemetry and does not operate an intermediary service.

It connects directly to:

- `https://api.leetgpu.com` and `wss://api.leetgpu.com` for challenges, account data, execution, submissions, and leaderboards.
- `https://yhdtysacdkqoquvkdwdd.supabase.co` to exchange and refresh the imported LeetGPU session.

Run and Submit send the active solution code, challenge identifier, language, selected accelerator, visibility, user identifier, and generated submission identifier to LeetGPU. Read LeetGPU's own terms and privacy policy before use.

The imported session is stored using VS Code `SecretStorage`. It is never written to workspace files or extension logs. Account disconnection deletes the local secret but does not revoke the corresponding server session.
