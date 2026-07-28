# Security Policy

## Reporting

Do not include LeetGPU access tokens, refresh tokens, submitted code, or personal account data in a public issue. Report extension vulnerabilities privately to the repository owner.

## Security model

- Problem HTML is sanitized and rendered under a restrictive Webview Content Security Policy.
- Only HTTPS problem links can be opened.
- Service endpoints are fixed to LeetGPU and its current Supabase project.
- Session values use VS Code encrypted `SecretStorage` and are redacted from errors.
- Clipboard session import requires structured JSON and only runs after an explicit command.
- Direct GitHub and Google browser callbacks are disabled while LeetGPU rejects the extension callback URL.
- Submission connections are never automatically replayed after a disconnect.
- PTX/SASS compilation is user-triggered, uses the fixed LeetGPU API endpoint, and keeps generated output in read-only virtual documents.

This unofficial integration depends on undocumented service contracts. Disable or uninstall the extension and remove its local session if unexpected authentication behavior occurs.
