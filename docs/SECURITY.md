# Security notes

## Phase 0 rules

- No real credentials or Twitch tokens belong in the repository, browser bundle,
  screenshots, event payloads, or logs.
- Phase 0 does not request Twitch credentials. The Twitch adapter is a stub.
- Local mock identities and chat text are synthetic and untrusted. Validate
  inputs, enforce bounded payloads, and render messages as plain text.
- Do not let chat content run commands, HTML, or code.
- Keep the local development service bound to loopback by default. Simulation
  routes exist only in explicit development mode, require a loopback peer even
  if the bind host changes, accept only `mock` provider events, and are limited
  to 20 requests per minute per client IP. They must remain absent in
  `NODE_ENV=production`.
- Vite's development server must bind only to a loopback address. Validate the
  final resolved server host after config, environment, and CLI options are
  merged, before binding. Reject wildcard and other externally reachable hosts,
  including CLI `--host` overrides. Simulation POSTs must have either no Origin
  from a loopback CLI client or an exact permitted
  local Vite Origin. When `Sec-Fetch-Site` is present, accept only
  `same-origin`. Determine locality from the socket peer address; never use
  `X-Forwarded-For` or another client-supplied forwarding header for access
  authorization.
- Development WebSocket subscriptions must restrict browser Origins to the
  explicit local Vite origin allowlist and require a loopback peer. Production
  WebSocket access requires authentication and appropriate event authorization
  before it is enabled.
- The overlay is read-only and must not include streamer administration or
  secret values.

## Future Twitch OAuth/EventSub requirements

Use official Twitch APIs. Validate OAuth state and exact redirect URIs, request
the minimum chat scopes, keep tokens server-side in protected storage, avoid
logging authorization headers, handle revocation and reconnects, validate all
EventSub data, and never trust chat text as an instruction to the application
or coding agent.

## Not in scope

No payments, privileged computer use, unsolicited chat posting, user tracking,
production deployment, or production account storage is introduced in Phase 0.
