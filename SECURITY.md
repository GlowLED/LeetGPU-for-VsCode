# Security Policy

## Reporting

Do not include LeetGPU access tokens, refresh tokens, submitted code, or personal account data in a public issue. Report extension vulnerabilities privately to the repository owner.

## Security model

- Problem HTML is sanitized and rendered under a restrictive Webview Content Security Policy.
- Only HTTPS problem links can be opened.
- Service endpoints are fixed to LeetGPU and its current Supabase project.
- Session values use VS Code encrypted `SecretStorage` and are redacted from errors.
- Automatic browser authentication launches a persistent, extension-owned Chromium profile with a debugging endpoint bound to `127.0.0.1`. It reads and immediately removes only LeetGPU's `sb-…-auth-token` local-storage entry, closes the browser after success, failure, cancellation, replacement, or timeout, and retains only the dedicated browser state (including GitHub/Google cookies) needed for later authorization.
- The dedicated profile is stored under VS Code extension global storage and can be deleted with **LeetGPU: Reset Browser Sign-In Profile**.
- Clipboard session import requires structured JSON and only runs after an explicit command.
- Existing browser profiles, cookies, history, tabs, and local storage are never opened or inspected.
- Submission connections are never automatically replayed after a disconnect.
- PTX/SASS compilation is user-triggered, uses the fixed LeetGPU API endpoint, and keeps generated output in read-only virtual documents.

This unofficial integration depends on undocumented service contracts. Disable or uninstall the extension and remove its local session if unexpected authentication behavior occurs.
