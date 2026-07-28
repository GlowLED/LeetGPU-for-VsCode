# Security Policy

## Reporting

Do not include LeetGPU access tokens, refresh tokens, submitted code, or personal account data in a public issue. Report extension vulnerabilities privately to the repository owner.

## Security model

- Problem HTML is sanitized and rendered under a restrictive Webview Content Security Policy.
- Only HTTPS problem links can be opened.
- Service endpoints are fixed to LeetGPU and its current Supabase project.
- Session values use VS Code encrypted `SecretStorage` and are redacted from errors.
- Submission connections are never automatically replayed after a disconnect.

This unofficial integration depends on undocumented service contracts. Disable or uninstall the extension and remove its local session if unexpected authentication behavior occurs.
