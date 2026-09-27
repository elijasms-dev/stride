# Security hardening and remaining release gates

24 September 2026. These are source-level and isolated-test results, not certification of the production gateway.

## Implemented

- Current routes record safe operation names, bounded elapsed milliseconds, HTTP status, a generated correlation ID and a closed error category for server failures. Messages, stacks, account identifiers, request URLs, notes, coordinates, provider payloads and credentials are excluded. The existing generic client error and owner/account/version guards remain in place.
- CSP adds `frame-ancestors 'self'`, `worker-src 'self'` and `manifest-src 'self'`; `X-Frame-Options: SAMEORIGIN` covers older clients. Existing object/base/form restrictions remain. Scripts are not newly restricted: the current inline appearance bootstrap and framework hydration need a tested nonce/hash policy before script containment can be claimed.
- New provider credentials use an authenticated `stride:v1:<key-id>:<ciphertext>` envelope. AES-GCM protects the key-ID header as additional authenticated data; each write uses a fresh 96-bit IV. Existing unversioned credentials still decrypt with the legacy secret. Reads re-encrypt older envelopes using an atomic comparison against owner, connection generation and prior ciphertext so rotation cannot overwrite a concurrent reconnection.

## Rotation procedure

1. Keep `STRIDE_ENCRYPTION_KEY` unchanged while any unversioned or `legacy` envelope remains. This reserved legacy slot preserves existing accounts.
2. Add `STRIDE_ENCRYPTION_KEYS` as a secret JSON object mapping IDs to cryptographically random secrets of at least 32 characters. A maximum of eight retained versions is allowed. IDs use letters, digits, `_` or `-`; `legacy` is reserved.
3. Set `STRIDE_ENCRYPTION_KEY_ID` to the new active ID. New writes immediately use it; reads migrate older stored credentials. Retain previous IDs and their exact secrets during the migration window.
4. Verify all stored envelopes have the intended prefix before retiring an old key. Dormant connections do not migrate until read; run an operator-controlled migration or require reconnection rather than guessing they have moved. Backups containing older envelopes need the corresponding retained key or explicit documented expiry.
5. Emergency compromise is different from routine rotation: revoke affected upstream API credentials, reconnect accounts and retire compromised encryption material. Retaining an old key does not revoke the provider token.

No runtime secrets, provider accounts, deployment settings or existing encrypted database rows were manually changed by this implementation.

## Production identity remains a release blocker

`ownerId` deliberately continues to consume the Sites gateway identity header. The installed `@openai/sites-vite-plugin` strips caller-supplied identity headers and supplies simulated local identity inside its `configureServer` development middleware. Its README explicitly states that production builds do not contain simulated users or sessions. The plugin's production packaging code is not evidence of the production authentication boundary.

Before public release, an operator must verify and record:

- Every private route passes through the real authenticated gateway and caller-provided `oai-authenticated-user-*` headers are stripped/replaced there.
- The underlying worker/origin cannot be reached publicly while bypassing that gateway, including provider-assigned domains and alternate hostnames.
- Unauthenticated, expired and signed-out sessions receive no private data even when forged identity headers are supplied.
- Two real test accounts cannot read, export, mutate, restore, queue or deliver each other's data, including stale browser tabs and offline queues.
- Actual deployed responses carry the intended CSP, framing, no-store and other security headers.

Do not deploy the built worker to a directly reachable generic host with this header trust model. A deployment outside the protected Sites boundary requires verified server sessions or signed identity tokens; a configurable header name or hostname allowlist is not a substitute. No production bypass was attempted or demonstrated in this work, and local header tests do not certify production isolation.

## Remaining operational evidence

A successful unit suite does not establish load capacity, alert delivery, backup recovery, deployed header behavior, native-device battery/GPS behavior or screen-reader usability. Set up monitoring for server/provider error rates and latency; execute production-like burst, restore and real-device checks before removing their release gates.
